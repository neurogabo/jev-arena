import { createHash } from 'node:crypto';
import { buildTurnActions } from '../showdown/actions.js';
import { formatId, loadEngine } from '../showdown/engine.js';
import { executeReplacementEntry, inspectReplacement } from './replacement.js';
import {
  SIM_VERSION,
  type ActionConsequence, type ConsequenceReport, type HypothesisSet,
  type SimHypothesis, type SimObservation, type SimPosition,
} from './types.js';

const DEFAULT_BRANCHES = 512;
const DEFAULT_SAMPLES = 2;
const PUBLIC_EVENTS = new Set([
  'move', 'cant', 'switch', 'drag', 'replace', 'detailschange', 'faint', 'turn',
  '-damage', '-heal', '-sethp', '-status', '-curestatus', '-cureteam',
  '-boost', '-unboost', '-setboost', '-swapboost', '-copyboost', '-clearboost',
  '-clearallboost', '-clearpositiveboost', '-clearnegativeboost', '-invertboost',
  '-crit', '-supereffective', '-resisted', '-immune', '-miss', '-fail', '-notarget',
  '-ohko', '-hitcount', '-prepare', '-mustrecharge', '-activate', '-start', '-end',
  '-singleturn', '-singlemove', '-sidestart', '-sideend', '-fieldstart', '-fieldend',
  '-weather', '-ability', '-item', '-enditem', '-transform', '-formechange',
  '-mega', '-primal', '-terastallize', '-block',
]);
const LIMITATIONS = [
  'Every endpoint is conditional on its hypothesis and hypothetical opponent command; it is not a predicted future.',
  'Only responses available in the reconstructed hypothetical opponent request are considered; unknown sets are not exhaustively covered.',
  'Random samples use independent analysis randomness, are paired across own actions, and do not exhaust random outcomes.',
  'Execution stops at the next decision or replacement request, including a replacement within the current turn.',
  'Opponent endpoints include active and publicly fainted Pokemon only; hidden bench changes are omitted. HP is public rounded percentage.',
];

type PreparedHypothesis = {
  hypothesis: SimHypothesis;
  opponentCommands: (string | null)[];
  error?: string;
};

function ourSide(observation: SimObservation): 'p1' | 'p2' {
  const stateRequest = observation.input.state.request as { ourSide?: unknown } | undefined;
  const identities = [observation.request.side?.id, observation.input.requestIdentity?.ourSide, stateRequest?.ourSide]
    .filter(value => value !== undefined);
  if (!identities.length || identities.some(value => value !== identities[0]) || !['p1', 'p2'].includes(String(identities[0]))) {
    throw new Error('The authorized observation does not identify one consistent player side.');
  }
  return identities[0] as 'p1' | 'p2';
}

/** Centered strata cover the whole menu; no command prefix receives preferential coverage. */
function sampledIndices(total: number, count: number): number[] {
  return Array.from({ length: count }, (_, index) => Math.floor((index + 0.5) * total / count));
}

/** Common analysis randomness across competing own actions, unrelated to any supplied snapshot seed. */
function analysisSeed(hypothesisId: string, opponentCommand: string | null, sample: number): string {
  const digest = createHash('sha256').update(JSON.stringify([SIM_VERSION, 'analysis-only', hypothesisId, opponentCommand, sample])).digest();
  return [0, 2, 4, 6].map(offset => digest.readUInt16BE(offset)).join(',');
}

/** Native request construction may auto-fill pass for a leading unavailable slot. No chosen move/switch is accepted. */
export function clearHypotheticalForcedPasses(battle: any): boolean {
  if (battle.queue.list.length || battle.sides.some((side: any) => !side || side.choice.actions.some((action: any, slot: number) => {
    const actor = side.active[slot];
    return action.choice !== 'pass' || !actor || !(battle.requestState === 'move' ? actor.fainted || actor.volatiles.commanding :
      battle.requestState === 'switch' && !actor.switchFlag);
  }))) return false;
  for (const side of battle.sides) side.clearChoice();
  return true;
}

function readyBattle(battle: any, side: 'p1' | 'p2', replacement: boolean, allowForcedPasses = false): boolean {
  if (allowForcedPasses && !clearHypotheticalForcedPasses(battle)) return false;
  // A continuation queue may contain private commands. Never consume it, even if a caller supplied one.
  return !battle.ended && battle.requestState === (replacement ? 'switch' : 'move') && battle.queue.list.length === 0 &&
    battle.sides.length === 2 && battle.sides.every((entry: any) => entry && entry.choice.actions.length === 0) &&
    Boolean(battle[side].activeRequest && !battle[side].activeRequest.wait && !battle[side].activeRequest.teamPreview);
}

function prepareHypothesis(engine: any, hypothesis: SimHypothesis, side: 'p1' | 'p2', replacement: boolean, allowForcedPasses = false): PreparedHypothesis {
  let battle: any;
  try {
    battle = engine.Battle.fromJSON(hypothesis.snapshot);
    if (!readyBattle(battle, side, replacement, allowForcedPasses)) {
      return { hypothesis, opponentCommands: [null], error: 'Hypothesis is not a fresh matching decision request with an empty command queue.' };
    }
    if (battle.sides.some((entry: any) => entry.pokemon.some((pokemon: any) => !hypothesis.actorIds[pokemon.fullname]))) {
      return { hypothesis, opponentCommands: [null], error: 'Hypothesis does not preserve every authorized Pokemon identity.' };
    }
    const opponent = side === 'p1' ? 'p2' : 'p1';
    const request = battle[opponent].activeRequest;
    if (!request || request.teamPreview) {
      return { hypothesis, opponentCommands: [null], error: 'Hypothetical opponent request is unavailable or unsupported.' };
    }
    if (request.wait) return { hypothesis, opponentCommands: [null] };
    const targets = battle[side].active.map((pokemon: any, slot: number) => ({
      id: pokemon ? hypothesis.actorIds[pokemon.fullname]! : `${side}-slot-${slot + 1}`,
      name: pokemon?.name ?? `position ${slot + 1}`, slot, alive: Boolean(pokemon && !pokemon.fainted),
    }));
    const opponentCommands = buildTurnActions(request, targets).map(action => action.command);
    if (!opponentCommands.length) return { hypothesis, opponentCommands: [null], error: 'Hypothetical opponent request has no supported commands.' };
    return { hypothesis, opponentCommands };
  } catch {
    // Engine errors may embed serialized data, requests or private values. Do not export their text.
    return { hypothesis, opponentCommands: [null], error: 'Hypothesis could not be loaded or its opponent menu could not be generated.' };
  } finally { battle?.destroy(); }
}

/** The pinned protocol encodes |split|side, private line, shared line. Select only shared lines. */
function publicEvents(lines: readonly string[]): string[] {
  const result: string[] = [];
  for (let index = 0; index < lines.length; index++) {
    let line = lines[index]!;
    if (line.startsWith('|split|')) {
      if (!/^\|split\|p[12]$/.test(line) || index + 2 >= lines.length) throw new Error('Incomplete public protocol split.');
      line = lines[index + 2]!;
      index += 2;
    }
    if (PUBLIC_EVENTS.has(line.split('|')[1] ?? '')) result.push(line);
  }
  return result;
}

function publicPosition(battle: any, hypothesis: SimHypothesis, side: 'p1' | 'p2'): SimPosition {
  const pokemon: SimPosition['pokemon'] = [];
  for (const engineSide of battle.sides) {
    for (const actor of engineSide.pokemon) {
      const own = engineSide.id === side;
      const active = engineSide.active.includes(actor);
      const fainted = Boolean(actor.fainted || actor.hp <= 0);
      if (!own && !active && !fainted) continue;
      const health = String(actor.getHealth().shared);
      const hp = /^(\d+)(?:\/(\d+))?/.exec(health);
      if (!hp) throw new Error('Public health could not be projected.');
      const identity = hypothesis.actorIds[actor.fullname];
      if (!identity) throw new Error('Pokemon identity could not be projected.');
      const visible = own ? actor : actor.illusion ?? actor;
      pokemon.push({
        id: identity, side: own ? 'own' : 'opponent', name: visible.name,
        active, fainted, hpPercent: fainted ? 0 : Number(hp[1]) * 100 / Number(hp[2] ?? 100),
        status: actor.status || null, species: visible.species.name,
        boosts: Object.fromEntries(Object.entries(actor.boosts).filter(([, value]) => value !== 0)) as Record<string, number>,
      });
    }
  }
  return {
    pokemon, weather: battle.field.weather || null, terrain: battle.field.terrain || null,
    pendingReplacement: battle.sides.some((entry: any) => entry.activeRequest?.forceSwitch?.some(Boolean)),
    battleEnded: Boolean(battle.ended),
  };
}

/** One conditional turn or replacement-entry horizon. Never reads the evaluator or an actual battle snapshot. */
export async function simulateConsequences(
  observation: SimObservation,
  hypotheses: HypothesisSet,
  options: { maxBranches?: number; samples?: number;
    opponentCommandsByHypothesis?: Record<string, (string | null)[]> } = {},
): Promise<ConsequenceReport> {
  const maxBranches = options.maxBranches ?? DEFAULT_BRANCHES;
  const samples = options.samples ?? DEFAULT_SAMPLES;
  if (!Number.isSafeInteger(maxBranches) || maxBranches < 0 || !Number.isSafeInteger(samples) || samples < 1) {
    throw new Error('Simulation budget must be a nonnegative integer and samples must be a positive integer.');
  }
  const portfolio = options.opponentCommandsByHypothesis;
  if (portfolio !== undefined) {
    if (!['move', 'replacement'].includes(observation.input.phase) || !observation.input.candidates.length) {
      throw new Error('Opponent portfolio requires a turn or replacement observation with own actions.');
    }
    const ids = hypotheses.hypotheses.map(hypothesis => hypothesis.id);
    if (!portfolio || typeof portfolio !== 'object' || Array.isArray(portfolio) || !ids.length ||
        new Set(ids).size !== ids.length || Object.keys(portfolio).length !== ids.length ||
        ids.some(id => !Object.hasOwn(portfolio, id) || !Array.isArray(portfolio[id]) || !portfolio[id]!.length ||
          new Set(portfolio[id]).size !== portfolio[id]!.length ||
          portfolio[id]!.some(command => command !== null && typeof command !== 'string'))) {
      throw new Error('Opponent portfolio must contain one nonempty unique command list for every hypothesis and no other keys.');
    }
  }
  const actions: ActionConsequence[] = observation.input.candidates.map(action => ({
    ...action, status: 'unknown', branches: [], omittedBranches: 0, notes: [],
  }));
  const report: ConsequenceReport = {
    version: SIM_VERSION, observationKey: observation.input.key,
    ...(hypotheses.inference ? { inference: structuredClone(hypotheses.inference),
      hypothesisRosters: Object.fromEntries(hypotheses.hypotheses.map(h => [h.id, structuredClone(h.roster!)])) } : {}),
    assumptions: hypotheses.hypotheses.map(hypothesis => ({ id: hypothesis.id, conditions: [...hypothesis.assumptions] })),
    coverage: {
      hypothesisCount: hypotheses.hypotheses.length, plannedBranches: 0, simulatedBranches: 0,
      failedBranches: 0, omittedBranches: 0, exhaustive: false,
      limitations: [...LIMITATIONS, hypotheses.coverage, ...hypotheses.unsupported].filter(Boolean),
    }, actions,
  };
  const replacement = observation.input.phase === 'replacement';
  if (replacement) report.coverage.limitations.push('Replacement branches stop after switch/entry effects or an earlier new replacement request; they do not simulate remaining attacks, residuals, or a complete turn.');
  if (!actions.length || !hypotheses.hypotheses.length || observation.input.phase === 'team-preview') {
    const reason = !hypotheses.hypotheses.length ? 'No supported observation-derived hypotheses are available.' :
      observation.input.phase === 'team-preview' ? 'Team preview is outside turn and replacement-entry simulation.' : 'The original action menu is empty.';
    report.coverage.limitations.push(reason);
    actions.forEach(action => action.notes.push(reason));
    return report;
  }
  let side: 'p1' | 'p2';
  try { side = ourSide(observation); } catch {
    if (portfolio !== undefined) throw new Error('Opponent portfolio requires one consistent authorized player side.');
    const reason = 'The authorized observation does not identify one consistent player side.';
    report.coverage.limitations.push(reason);
    actions.forEach(action => action.notes.push(reason));
    return report;
  }
  const engine = await loadEngine();
  const prepared = hypotheses.hypotheses.map(hypothesis => prepareHypothesis(engine, hypothesis, side, replacement, portfolio !== undefined));
  if (portfolio !== undefined) {
    for (const entry of prepared) {
      const selected = portfolio[entry.hypothesis.id]!;
      if (entry.error || selected.some(command => !entry.opponentCommands.includes(command))) {
        throw new Error('Opponent portfolio contains a command outside the fresh hypothetical legal menu.');
      }
      // Request enumeration is checked against native acceptance without ever providing an own choice.
      // Thus neither a pending opponent turn nor a hidden continuation can execute during validation.
      let battle: any;
      try {
        battle = engine.Battle.fromJSON(entry.hypothesis.snapshot);
        battle.send = () => {};
        if (!clearHypotheticalForcedPasses(battle)) throw new Error('pending choice');
        const opponentSide = side === 'p1' ? 'p2' : 'p1';
        for (const command of selected) {
          if (command !== null && !battle.choose(opponentSide, command)) throw new Error('refused');
          battle[opponentSide].clearChoice();
        }
      } catch {
        throw new Error('Opponent portfolio command was refused by the fresh hypothetical engine request.');
      } finally { battle?.destroy(); }
      entry.opponentCommands = [...selected];
    }
    report.coverage.limitations.push('Opponent responses were restricted to an explicit bounded portfolio, shared across own actions. Coverage counts describe that portfolio, not all legal opponent commands; its selection scores are not opponent probabilities.');
  }
  const replacementTiming = replacement ? inspectReplacement(observation, engine.Dex.forFormat(formatId)).timing : undefined;
  const quota = Math.floor(maxBranches / (actions.length * prepared.length));
  const perActionPlanned = prepared.reduce((total, entry) => total + entry.opponentCommands.length * samples, 0);
  report.coverage.plannedBranches = actions.length * perActionPlanned;
  if (!Number.isSafeInteger(report.coverage.plannedBranches)) throw new Error('Simulation branch count exceeds safe accounting limits.');
  if (quota === 0) report.coverage.limitations.push('Budget cannot cover one branch for every action and hypothesis; no action receives preferential simulation.');
  const opponent = side === 'p1' ? 'p2' : 'p1';
  for (const action of actions) {
    for (const entry of prepared) {
      const total = entry.opponentCommands.length * samples;
      const selected = sampledIndices(total, Math.min(total, quota));
      action.omittedBranches += total - selected.length;
      if (entry.error) action.notes.push(entry.error);
      for (const index of selected) {
        const opponentCommand = entry.opponentCommands[Math.floor(index / samples)]!;
        const sample = index % samples;
        const branch = {
          hypothesisId: entry.hypothesis.id, opponentAction: opponentCommand ?? '(no opponent choice)', sample,
          horizon: replacement ? 'replacement-entry' as const : 'next-decision' as const,
          ...(replacement ? { replacementTiming } : {}),
        };
        if (entry.error) {
          action.branches.push({ ...branch, status: 'error', error: entry.error });
          report.coverage.failedBranches++;
          continue;
        }
        let battle: any;
        try {
          battle = engine.Battle.fromJSON(entry.hypothesis.snapshot);
          battle.send = () => {};
          battle.debugMode = false;
          battle.reportExactHP = false;
          battle.reportPercentages = true;
          battle.resetRNG(analysisSeed(entry.hypothesis.id, opponentCommand, sample));
          const initialTurn = battle.turn;
          const initialLogLength = battle.log.length;
          const entryResult = replacement ? executeReplacementEntry(battle, side, action.command, opponentCommand) : null;
          if (entryResult ? !entryResult.accepted && entryResult.reason === 'own' : !battle.choose(side, action.command)) {
            action.branches.push({ ...branch, status: 'error', error: 'Original own command was refused by the hypothetical engine request.' });
            report.coverage.failedBranches++;
            continue;
          }
          if (entryResult ? !entryResult.accepted && entryResult.reason === 'opponent' : opponentCommand !== null && !battle.choose(opponent, opponentCommand)) {
            action.branches.push({ ...branch, status: 'error', error: 'Opponent command generated from the hypothetical request was refused.' });
            report.coverage.failedBranches++;
            continue;
          }
          if (replacement ? battle.turn !== initialTurn : battle.turn > initialTurn + 1 || (!battle.ended && !battle.requestState)) {
            throw new Error('Simulation did not stop at the next decision boundary.');
          }
          action.branches.push({
            ...branch, status: 'simulated', position: publicPosition(battle, entry.hypothesis, side),
            events: publicEvents(battle.log.slice(initialLogLength)),
          });
          report.coverage.simulatedBranches++;
        } catch {
          action.branches.push({ ...branch, status: 'error', error: 'Conditional branch could not be executed or safely projected.' });
          report.coverage.failedBranches++;
        } finally { battle?.destroy(); }
      }
    }
    const successes = action.branches.filter(branch => branch.status === 'simulated').length;
    const failures = action.branches.length - successes;
    action.status = successes === 0 ? 'unknown' : action.omittedBranches || failures || hypotheses.unsupported.length ? 'partial' : 'simulated';
    if (action.omittedBranches) action.notes.push(`${action.omittedBranches} planned branches omitted by equal allocation across all original actions and hypotheses.`);
    if (failures) action.notes.push(`${failures} conditional branches could not be simulated; refusal does not remove or rank the original action.`);
    action.notes = [...new Set(action.notes)];
    report.coverage.omittedBranches += action.omittedBranches;
  }
  if (report.coverage.omittedBranches) report.coverage.limitations.push('Budget is a ceiling: centered strata within an equal per-action/per-hypothesis quota omit branches explicitly; leftover budget does not privilege an action.');
  return report;
}
