import type { SimObservation } from './types.js';

export type ReplacementTiming = 'end-turn' | 'interrupted-turn' | 'unknown';
export type ReplacementEvidence = {
  timing: ReplacementTiming;
  evidence: string[];
  /** Only already-observed self-switch moves, never a pending opposing choice. */
  sourceMoves: Record<string, string>;
};

const id = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
const identity = (value: string) => value.replace(/^(p[12])[ab]: /, '$1: ');

/** Timing is evidence-bounded. A faint alone does not establish that the turn has ended. */
export function inspectReplacement(observation: SimObservation, dex: any): ReplacementEvidence {
  const result: ReplacementEvidence = { timing: 'unknown', evidence: [], sourceMoves: {} };
  if (observation.input.phase !== 'replacement') return result;
  let start = 0;
  for (let index = 0; index < observation.log.length; index++) if (observation.log[index]!.startsWith('|turn|')) start = index;
  const current = observation.log.slice(start);
  let lastMove = -1, lastUpkeep = -1;
  for (let index = 0; index < current.length; index++) {
    if (current[index]!.startsWith('|move|')) lastMove = index;
    if (current[index] === '|upkeep') lastUpkeep = index;
  }
  if (lastUpkeep >= 0 && lastUpkeep > lastMove) {
    result.timing = 'end-turn'; result.evidence.push(current[lastUpkeep]!);
    return result;
  }
  if (lastMove < 0) return result;
  const line = current[lastMove]!;
  const [, , actor = '', move = ''] = line.split('|');
  const moveData = dex.moves.get(id(move));
  const active = observation.request.side?.pokemon.slice(0, observation.request.forceSwitch?.length ?? 0) ?? [];
  const slot = active.findIndex(pokemon => pokemon.ident === identity(actor));
  if (slot < 0 || !observation.request.forceSwitch?.[slot] || /(?:^0(?:\s|\/)|\bfnt\b)/.test(active[slot]!.condition)) return result;
  // A switch/drag after this move would invalidate its use as the current switch cause.
  if (current.slice(lastMove + 1).some(event => /^\|(?:switch|drag)\|/.test(event) && identity(event.split('|')[2] ?? '') === identity(actor))) return result;
  if (current.slice(lastMove + 1).some(event => /^\|(?:-fail|cant)\|/.test(event) && identity(event.split('|')[2] ?? '') === identity(actor))) return result;
  if (moveData.exists && moveData.selfSwitch) {
    result.timing = 'interrupted-turn'; result.evidence.push(line);
    result.sourceMoves[identity(actor)] = moveData.id;
  }
  return result;
}

/** Configure native replacement requests on a NEW observation-derived battle only. */
export function prepareReplacementState({ battle, observation, actorById, assumptions, endpoint }: {
  battle: any; observation: SimObservation; actorById: Record<string, any>;
  assumptions: string[]; endpoint: 'low' | 'high';
}): ReplacementEvidence {
  if (observation.input.phase !== 'replacement' || !observation.request.forceSwitch?.some(Boolean)) {
    throw new Error('Replacement setup requires an actionable native replacement request.');
  }
  const side = observation.request.side?.id;
  if (side !== 'p1' && side !== 'p2') throw new Error('Replacement setup lacks an authorized player side.');
  const opponent = side === 'p1' ? 'p2' : 'p1';
  const evidence = inspectReplacement(observation, battle.dex);
  if (battle.queue.list.length) throw new Error('Replacement construction must not contain a continuation queue.');
  for (const engineSide of battle.sides) {
    engineSide.clearChoice();
    for (const pokemon of engineSide.pokemon) {
      pokemon.switchFlag = false;
      pokemon.forceSwitchFlag = false;
      pokemon.skipBeforeSwitchOutEventFlag = false;
    }
  }
  const mons = observation.input.state.pokemon as { id: string; side: string; slot: number | null; name: string }[];
  observation.request.forceSwitch.forEach((forced, slot) => {
    if (!forced) return;
    const actor = battle[side].active[slot];
    const observed = mons.find(mon => mon.side === side && mon.slot === slot);
    if (!actor || !observed || actorById[observed.id] !== actor || actor.fullname !== observation.request.side!.pokemon[slot]!.ident) {
      throw new Error('Replacement setup cannot preserve the authorized active identity.');
    }
    actor.switchFlag = evidence.sourceMoves[actor.fullname] ?? true;
    // Native requests arrive after BeforeSwitchOut has already run. Its private continuation is not replayed.
    actor.skipBeforeSwitchOutEventFlag = Boolean(actor.hp);
    if (actor.hp && !evidence.sourceMoves[actor.fullname]) {
      assumptions.push(`${observed.id}: replacement cause is not established by a current public self-switch move; ordinary switch-out effects are assumed, with no copied volatile state.`);
    }
  });
  const canReplaceOpponent = battle[opponent].pokemon.some((pokemon: any) => !pokemon.isActive && !pokemon.fainted && pokemon.hp > 0);
  const opponentFaintedSlots = battle[opponent].active.filter((pokemon: any) => pokemon?.fainted || pokemon?.hp === 0);
  const includeOpponentReplacement = evidence.timing === 'end-turn' || (evidence.timing === 'unknown' && endpoint === 'high');
  if (canReplaceOpponent && opponentFaintedSlots.length) {
    if (includeOpponentReplacement) for (const pokemon of opponentFaintedSlots) pokemon.switchFlag = true;
    if (evidence.timing === 'unknown') assumptions.push(`Replacement timing is not established: this ${endpoint} hypothesis ${includeOpponentReplacement ? 'includes' : 'defers'} simultaneous replacement of publicly fainted opposing active Pokemon.`);
    if (evidence.timing === 'interrupted-turn') assumptions.push('Opposing faint replacements are deferred during the observed self-switch interruption; no hidden remaining move queue is reconstructed.');
  }
  battle.midTurn = true;
  battle.makeRequest('switch');
  battle[side].activeRequest = structuredClone(observation.request);
  assumptions.push(`Replacement timing: ${evidence.timing}${evidence.evidence.length ? `, supported by ${evidence.evidence.join(' / ')}` : '; the public log does not establish a turn-end boundary'}.`);
  assumptions.push('Replacement horizon ends after selected switches and their entry effects, or an earlier new replacement request. Remaining attacks, residual effects and the next turn are not simulated.');
  if (Object.values(evidence.sourceMoves).includes('batonpass')) assumptions.push('The publicly observed Baton Pass is retained as the native switch source; the engine copies its transferable current boosts and effects.');
  return evidence;
}

/** Apply native choices, then execute only their switch/entry queue, without a turn loop. */
export function executeReplacementEntry(
  battle: any, side: 'p1' | 'p2', command: string, opponentCommand: string | null,
): { accepted: true } | { accepted: false; reason: 'own' | 'opponent' } {
  if (battle.requestState !== 'switch' || battle.queue.list.length || battle.sides.some((entry: any) => entry.choice.actions.length)) {
    throw new Error('Entry simulation requires a fresh replacement request without pre-existing commands.');
  }
  const opponent = side === 'p1' ? 'p2' : 'p1';
  if (!battle[side].choose(command) || !battle[side].isChoiceDone()) return { accepted: false, reason: 'own' };
  if (opponentCommand !== null && (!battle[opponent].choose(opponentCommand) || !battle[opponent].isChoiceDone())) return { accepted: false, reason: 'opponent' };
  if (!battle.allChoicesDone()) throw new Error('Entry simulation is missing a hypothetical replacement choice.');
  const allowedChoices = new Set(['instaswitch', 'pass']);
  if (battle.sides.some((entry: any) => entry.choice.actions.some((action: any) => !allowedChoices.has(action.choice)))) {
    throw new Error('Only native switch/pass replacement choices are supported at the entry horizon.');
  }
  battle.updateSpeed();
  for (const entry of battle.sides) entry.commitChoices();
  battle.clearRequest();
  battle.queue.sort();
  // Deliberately do not call Battle.commitChoices/turnLoop: those would continue an unavailable turn.
  let steps = 0;
  while (battle.queue.peek() && !battle.ended && !battle.requestState) {
    if (++steps > 32) throw new Error('Replacement entry event limit reached.');
    const action = battle.queue.shift();
    if (!['instaswitch', 'runSwitch', 'pass'].includes(action.choice)) throw new Error('Entry produced a continuation outside the declared horizon.');
    battle.runAction(action);
  }
  return { accepted: true };
}
