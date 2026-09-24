import { buildTurnActions } from '../showdown/actions.js';
import { loadEngine } from '../showdown/engine.js';
import { clearHypotheticalForcedPasses } from '../sim-v1/simulate.js';
import type { HypothesisSet, SimHypothesis, SimObservation } from '../sim-v1/types.js';

type Candidate = {
  command: string | null; description: string; features: string[]; signature: string;
  pressureProxy: number; allyBenefits: string[];
};
type Menu = { hypothesisId: string; candidates: Candidate[]; total: number;
  excluded: { damagingAllyWithoutBenefit: number; invalidNativeCommand: number } };
export type OpponentPortfolio = {
  commandsByHypothesis: Record<string, (string | null)[]>;
  audit: {
    version: 'opponent-portfolio-v1'; requestedCount: number; commonMenuCount: number;
    sameCommandsAcrossHypotheses: boolean; differences: string[]; limitations: string[];
    hypotheses: { id: string; legalMenuCount: number; eligibleMenuCount: number;
      excluded: Menu['excluded']; selected: Omit<Candidate, 'signature'>[] }[];
  };
};

/** Recognized triggers, not a claim that paying the HP cost is tactically worthwhile. */
function allyBenefit(battle: any, actor: any, target: any, move: any): string | null {
  if (!target || target.fainted || target.hp <= 0 || target.volatiles.substitute) return null;
  const ability = target.getAbility().id;
  const activeAbility = !target.ignoringAbility();
  const item = !target.ignoringItem() ? target.getItem().id : '';
  const type = move.type;
  if (!battle.dex.getImmunity(type, target)) return null;
  if (item === 'weaknesspolicy' && battle.dex.getImmunity(type, target) &&
      battle.dex.getEffectiveness(type, target) > 0 &&
      (target.boosts.atk < 6 || target.boosts.spa < 6)) return 'Weakness Policy may raise offenses after a surviving super-effective hit';
  if (!activeAbility || actor.hasAbility(['moldbreaker', 'teravolt', 'turboblaze'])) return null;
  if (ability === 'justified' && type === 'Dark' && target.boosts.atk < 6) return 'Justified can raise Attack after Dark damage';
  if (ability === 'stamina' && target.boosts.def < 6) return 'Stamina can raise Defense after damage';
  if (ability === 'weakarmor' && move.category === 'Physical' && target.boosts.spe < 6) return 'Weak Armor can raise Speed at a Defense cost';
  if (ability === 'steamengine' && ['Fire', 'Water'].includes(type) && target.boosts.spe < 6) return 'Steam Engine can raise Speed after Fire or Water damage';
  if (ability === 'rattled' && ['Bug', 'Dark', 'Ghost'].includes(type) && target.boosts.spe < 6) return 'Rattled can raise Speed after the matching damage type';
  if (ability === 'angerpoint' && move.willCrit && target.boosts.atk < 6) return 'Anger Point can maximize Attack after a surviving critical hit';
  if (ability === 'flashfire' && type === 'Fire' && !target.volatiles.flashfire) return 'Flash Fire can absorb Fire and activate its damage modifier';
  if ((ability === 'waterabsorb' || ability === 'dryskin') && type === 'Water' && target.hp < target.maxhp) return 'Water absorption can restore missing HP';
  if (ability === 'voltabsorb' && type === 'Electric' && target.hp < target.maxhp) return 'Volt Absorb can restore missing HP';
  if (ability === 'eartheater' && type === 'Ground' && target.hp < target.maxhp) return 'Earth Eater can restore missing HP';
  if (ability === 'sapsipper' && type === 'Grass' && target.boosts.atk < 6) return 'Sap Sipper can absorb Grass and raise Attack';
  if (ability === 'motordrive' && type === 'Electric' && target.boosts.spe < 6) return 'Motor Drive can absorb Electric and raise Speed';
  if (ability === 'lightningrod' && type === 'Electric' && target.boosts.spa < 6) return 'Lightning Rod can absorb Electric and raise Special Attack';
  if (ability === 'stormdrain' && type === 'Water' && target.boosts.spa < 6) return 'Storm Drain can absorb Water and raise Special Attack';
  return null;
}

function describe(battle: any, hypothesis: SimHypothesis, side: 'p1' | 'p2', command: string, description: string): Candidate | null {
  const opponent = side === 'p1' ? 'p2' : 'p1';
  const enemy = battle[opponent];
  const parts = command.split(',').map(part => part.trim());
  const features = new Set<string>(), signature: unknown[] = [], allyBenefits: string[] = [];
  let pressureProxy = 0;
  for (const [slot, part] of parts.entries()) {
    const actor = enemy.active[slot];
    if (part === 'pass') { signature.push(['pass', slot]); continue; }
    if (part.startsWith('switch ')) {
      const entrant = enemy.pokemon[Number(part.split(' ')[1]) - 1];
      features.add('switch'); features.add(`switch-slot:${slot}`);
      signature.push(['switch', slot, hypothesis.actorIds[entrant.fullname]]);
      continue;
    }
    const [, index, targetText, transformation] = /^move (\d+)(?: (-?\d+))?(?: (mega|megax|megay))?$/.exec(part) ?? [];
    if (!index || !actor) throw new Error('unsupported command');
    const requested = enemy.activeRequest.active[slot].moves[Number(index) - 1];
    const move = battle.dex.moves.get(requested?.id ?? 'struggle');
    const location = targetText ? Number(targetText) : null;
    const damaging = move.category !== 'Status';
    if (transformation) features.add('mega');
    signature.push(['move', hypothesis.actorIds[actor.fullname], move.id, location, transformation ?? null]);
    if (damaging && location !== null && location < 0) {
      const targetSlot = -location - 1;
      const targetPart = parts[targetSlot] ?? '';
      const target = targetPart.startsWith('switch ') ? enemy.pokemon[Number(targetPart.split(' ')[1]) - 1] : enemy.active[targetSlot];
      const targetMoveIndex = /^move (\d+)/.exec(targetPart)?.[1];
      const targetMove = targetMoveIndex ? battle.dex.moves.get(enemy.activeRequest.active[targetSlot]?.moves[Number(targetMoveIndex) - 1]?.id) : null;
      const protectedTarget = move.flags.protect && targetMove && (targetMove.volatileStatus === 'protect' || targetMove.stallingMove);
      // Mega can replace the triggering ability and types. Do not claim an unverified pre-Mega benefit.
      const benefit = protectedTarget || / mega[xy]?$/.test(targetPart) ? null : allyBenefit(battle, actor, target, move);
      if (!benefit) return null;
      features.add('ally-benefit'); allyBenefits.push(benefit);
      continue;
    }
    const priority = move.priority > 0 || (move.id === 'grassyglide' && battle.field.isTerrain('grassyterrain') && actor.isGrounded()) ||
      (move.category === 'Status' && actor.hasAbility('prankster'));
    if (priority && damaging) features.add('priority');
    const protectedEffect = move.volatileStatus === 'protect' || move.stallingMove ||
      ['wideguard', 'quickguard', 'craftyshield', 'matblock'].includes(move.sideCondition);
    if (protectedEffect) features.add('protection');
    else if (move.category === 'Status') features.add('control-or-setup');
    if (!damaging) continue;
    const targets = location !== null && location > 0 ? [battle[side].active[location - 1]] :
      ['allAdjacent', 'allAdjacentFoes', 'all', 'randomNormal'].includes(move.target) ? battle[side].active : [];
    for (const target of targets) {
      if (!target || target.fainted || target.hp <= 0) continue;
      features.add('attack'); features.add(`target:${hypothesis.actorIds[target.fullname]}`);
      features.add(`attack-type:${move.type}`);
      const typeFactor = battle.dex.getImmunity(move.type, target) ? 2 ** battle.dex.getEffectiveness(move.type, target) : 0;
      const stab = actor.hasType(move.type) ? 1.5 : 1;
      // A deterministic diversity tiebreaker, not damage, a KO estimate, or an opponent probability.
      pressureProxy += (move.basePower || (move.damage ? 50 : 0)) * typeFactor * stab;
    }
    if (move.target === 'allAdjacent') features.add('spread-with-ally-collateral');
  }
  return { command, description, features: [...features].sort(), signature: JSON.stringify(signature), pressureProxy, allyBenefits };
}

function readMenu(engine: any, observation: SimObservation, hypothesis: SimHypothesis, side: 'p1' | 'p2'): Menu {
  let battle: any;
  let stage = 'load';
  try {
    battle = engine.Battle.fromJSON(hypothesis.snapshot);
    battle.send = () => {};
    const replacement = observation.input.phase === 'replacement';
    stage = 'freshness';
    if (!clearHypotheticalForcedPasses(battle)) throw new Error('pending choice');
    if (battle.ended || battle.requestState !== (replacement ? 'switch' : 'move') || battle.queue.list.length ||
        battle.sides.length !== 2 || battle.sides.some((s: any) => !s || s.choice.actions.length ||
          s.pokemon.some((mon: any) => !hypothesis.actorIds[mon.fullname])) ||
        !battle[side].activeRequest || battle[side].activeRequest.wait || battle[side].activeRequest.teamPreview) throw new Error('unfresh');
    const opponent = side === 'p1' ? 'p2' : 'p1';
    const request = battle[opponent].activeRequest;
    stage = 'request';
    if (!request || request.teamPreview) throw new Error('missing request');
    const excluded = { damagingAllyWithoutBenefit: 0, invalidNativeCommand: 0 };
    if (request.wait) return { hypothesisId: hypothesis.id, total: 1, excluded,
      candidates: [{ command: null, description: 'No opponent choice is requested.', signature: 'wait', features: ['wait'], pressureProxy: 0, allyBenefits: [] }] };
    const targets = battle[side].active.map((mon: any, slot: number) => ({
      id: mon ? hypothesis.actorIds[mon.fullname]! : `${side}-slot-${slot + 1}`,
      name: mon?.name ?? `position ${slot + 1}`, slot, alive: Boolean(mon && !mon.fainted),
    }));
    stage = 'enumeration';
    const menu = buildTurnActions(request, targets);
    const candidates: Candidate[] = [];
    for (const action of menu) {
      stage = 'native-acceptance';
      const accepted = battle.choose(opponent, action.command);
      battle[opponent].clearChoice();
      if (!accepted) { excluded.invalidNativeCommand++; continue; }
      stage = 'features';
      const candidate = describe(battle, hypothesis, side, action.command, action.description);
      if (!candidate) { excluded.damagingAllyWithoutBenefit++; continue; }
      candidates.push(candidate);
    }
    stage = 'eligibility';
    if (!candidates.length) throw new Error('no eligible response');
    return { hypothesisId: hypothesis.id, candidates, total: menu.length - excluded.invalidNativeCommand, excluded };
  } catch {
    // Engine errors can embed serialized state. Expose only a bounded diagnostic.
    throw new Error(`Cannot construct an opponent portfolio from a fresh authorized hypothetical request with eligible commands (${stage}).`);
  } finally { battle?.destroy(); }
}

function select(candidates: Candidate[], count: number): Candidate[] {
  const selected: Candidate[] = [], covered = new Set<string>();
  const novelty = (candidate: Candidate) => candidate.features.reduce((sum, feature) => sum + (covered.has(feature) ? 0 :
    feature.startsWith('target:') ? 40 : feature === 'priority' ? 25 : feature === 'protection' ? 25 :
      feature === 'switch' ? 20 : feature === 'control-or-setup' ? 15 : feature.startsWith('attack-type:') ? 8 : 2), 0);
  const take = (pool: Candidate[], pressureFirst = false) => {
    const next = pool.filter(candidate => !selected.includes(candidate)).sort((a, b) =>
      (pressureFirst ? b.pressureProxy - a.pressureProxy : novelty(b) - novelty(a)) ||
      b.pressureProxy - a.pressureProxy || String(a.command).localeCompare(String(b.command), 'en'))[0];
    if (next && selected.length < count) { selected.push(next); next.features.forEach(feature => covered.add(feature)); }
  };
  take(candidates.filter(candidate => candidate.features.includes('attack')), true);
  if (!covered.has('priority')) take(candidates.filter(candidate => candidate.features.includes('priority')));
  if (!covered.has('protection')) take(candidates.filter(candidate => candidate.features.includes('protection')));
  while (selected.length < Math.min(count, candidates.length)) take(candidates);
  return selected;
}

/** The small response set is a coverage heuristic, never a prediction of a hidden opponent command. */
export async function buildOpponentPortfolio(observation: SimObservation, hypotheses: HypothesisSet, count = 4): Promise<OpponentPortfolio> {
  if (!Number.isSafeInteger(count) || count < 1 || count > 4) throw new Error('Opponent portfolio count must be an integer from one to four.');
  const side = observation.request.side?.id;
  const identitySide = observation.input.requestIdentity?.ourSide;
  const stateSide = (observation.input.state.request as { ourSide?: unknown } | undefined)?.ourSide;
  if ((side !== 'p1' && side !== 'p2') || [identitySide, stateSide].some(value => value !== undefined && value !== side) ||
      !['move', 'replacement'].includes(observation.input.phase) || !hypotheses.hypotheses.length ||
      new Set(hypotheses.hypotheses.map(h => h.id)).size !== hypotheses.hypotheses.length) {
    throw new Error('Opponent portfolio needs a matching turn/replacement observation and distinct reconstructed hypotheses.');
  }
  const engine = await loadEngine();
  const menus = hypotheses.hypotheses.map(hypothesis => readMenu(engine, observation, hypothesis, side));
  const common = menus[0]!.candidates.filter(candidate => menus.every(menu => menu.candidates.some(other =>
    other.command === candidate.command && other.signature === candidate.signature)));
  const shared = common.length ? select(common, count) : null;
  const commandsByHypothesis: Record<string, (string | null)[]> = {};
  const differences = shared ? common.length < count ? ['The shared legal menu has fewer eligible responses than requested; it is not padded with different commands.'] : [] :
    ['No semantically identical command is legal and eligible in every hypothesis; each hypothesis has an explicit separate portfolio.'];
  const audit: OpponentPortfolio['audit'] = {
    version: 'opponent-portfolio-v1', requestedCount: count, commonMenuCount: common.length,
    sameCommandsAcrossHypotheses: Boolean(shared), differences,
    limitations: [
      'This is a deterministic response coverage heuristic, not an exhaustive search, opponent probability, or guarantee.',
      'Attack pressure is only base power times ordinary type factor and STAB; it excludes stats, abilities, accuracy, damage rolls and opponent intent.',
      'One attacking response, an available damaging-priority response and an available protective response receive coverage before additional feature diversity.',
      'Direct damaging ally targets require a recognized conditional ability/item benefit; unrecognized combinations and receiving Mega transformations are excluded conservatively. Spread collateral is retained explicitly.',
      'The same response portfolio must be crossed with every shortlisted own action; hypotheses remain hypothetical, not private opponent observations.',
    ], hypotheses: [],
  };
  for (const menu of menus) {
    const chosen = shared ? shared.map(candidate => menu.candidates.find(other => other.command === candidate.command && other.signature === candidate.signature)!) : select(menu.candidates, count);
    commandsByHypothesis[menu.hypothesisId] = chosen.map(candidate => candidate.command);
    audit.hypotheses.push({ id: menu.hypothesisId, legalMenuCount: menu.total, eligibleMenuCount: menu.candidates.length,
      excluded: menu.excluded, selected: chosen.map(({ signature: _signature, ...candidate }) => candidate) });
  }
  return { commandsByHypothesis, audit };
}
