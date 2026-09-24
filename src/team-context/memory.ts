import { requestHash } from '../context-v6/questions.js';
import { LogOnlyObserver } from '../showdown/log-only.js';
import type { DecisionInput } from '../showdown/types.js';
import { byteLength, currentMove, currentObservation, finite, record, rows, strings, text } from './observation.js';
import { TEAM_CONTEXT_VERSION } from './types.js';
import type { BattleMemoryState } from './types.js';

const stats = (v: unknown) => Object.fromEntries(['hp', 'atk', 'def', 'spa', 'spd', 'spe', 'accuracy', 'evasion']
  .filter(key => finite(record(v)[key]) !== null).map(key => [key, finite(record(v)[key])]));
const effects = (v: unknown) => rows(v).map(e => ({ name: text(e.name), sinceTurn: finite(e.sinceTurn), remainingTurns: finite(e.remainingTurns) }));
const item = (v: unknown) => {
  const row = record(v);
  return row.status === 'known' && typeof row.cardId === 'string' ? { status: 'known', id: row.cardId }
    : { status: row.status === 'none' ? 'none' : 'unknown' };
};

/** Rebuilds facts from the current authorized projection; previous memory only supplies a delta. */
export function buildBattleMemory(input: DecisionInput, authorizedLog: string[], previous?: BattleMemoryState) {
  const observed = currentObservation(input);
  const observer = new LogOnlyObserver({ ourSide: observed.ourSide, battleId: observed.request.battleId });
  observer.receive(authorizedLog.join('\n'));
  if (JSON.stringify(observer.showdownLog) !== JSON.stringify(authorizedLog)) throw new Error('Memory requires an already authorized protocol log without auxiliary text.');
  const request = observer.ownRequest;
  if (request?.rqid !== undefined && observed.request.rqid !== request.rqid) throw new Error('Memory input and authorized request revision differ.');
  if (previous && (previous.version !== TEAM_CONTEXT_VERSION || previous.battleId !== observed.request.battleId || previous.ourSide !== observed.ourSide)) {
    throw new Error('Previous memory belongs to another battle or side.');
  }
  if (previous && (previous.logLength > authorizedLog.length || requestHash(authorizedLog.slice(0, previous.logLength)) !== previous.logHash)) {
    throw new Error('Previous memory is not a prefix of this authorized observation.');
  }
  const pokemon = observed.pokemon.map(p => {
    const own = p.side === observed.ourSide;
    const hp = record(p.hp);
    const loss = record(p.lastItemLoss);
    return { id: p.id, side: p.side, species: text(p.speciesId), types: strings(p.typeIds), slot: finite(p.slot),
      hp: own && finite(record(hp.exact).current) !== null ? { current: finite(record(hp.exact).current), max: finite(record(hp.exact).max) }
        : { percent: finite(hp.percent) }, fainted: p.fainted === null && finite(hp.percent) === null ? null : p.fainted === true || hp.percent === 0, status: text(p.status),
      ability: text(p.abilityId), item: item(p.item), itemLoss: typeof loss.itemId === 'string'
        ? { id: loss.itemId, turn: finite(loss.turn), consumed: typeof loss.consumed === 'boolean' ? loss.consumed : null } : null,
      stages: stats(p.statStages), effects: effects(p.effects),
      moves: strings(p.knownMoveIds).map(id => own ? { id, ...currentMove(input, p, id) } : { id, pp: null }),
      movesComplete: p.movesComplete === true, ...(own ? { stats: stats(p.stats) } : {}),
      enteredTurn: finite(p.enteredTurn), firstActionOpportunity: typeof p.firstActionOpportunity === 'boolean' ? p.firstActionOpportunity : null,
      protectChain: finite(p.protectChain), megaEvolved: p.megaEvolved === true,
      ...(own && p.slot !== null ? { canMegaNow: record(rows(record(input.state.actionConstraints).active)[p.slot]).canMegaEvolve === true } : {}),
      lastMove: text(p.lastMoveId), lastMoveTurn: finite(p.lastMoveTurn) };
  });
  const megaSpent: Record<string, boolean> = { p1: false, p2: false };
  for (const line of authorizedLog) {
    const match = /^\|-mega\|(p[12])[ab]:/.exec(line);
    if (match) megaSpent[match[1]!] = true;
  }
  for (const p of pokemon) if (p.megaEvolved) megaSpent[p.side] = true;
  const snapshot = { request: { battleId: observed.request.battleId, ourSide: observed.ourSide, rqid: finite(observed.request.rqid),
    turn: finite(observed.request.turn), phase: input.phase },
    pokemon, ...(Array.isArray(input.state.opponentPreview) ? { opponentRoster: {
      preview: input.state.opponentPreview, publiclyObservedIds: strings(input.state.observedOpponentIds),
      confirmedParticipantIds: Array.isArray(input.state.opponentSelectedIds) ? strings(input.state.opponentSelectedIds) : null,
      policy: 'Preview species are possibilities, not confirmed reserves. Participant identities come only from public entries.' } } : {}),
    field: effects(input.state.field), sideConditions: Object.fromEntries(['p1', 'p2'].map(side => [side, effects(record(input.state.sideConditions)[side])])),
    megaSpent, forceSwitch: Array.isArray(record(input.state.actionConstraints).forceSwitch)
      ? record(input.state.actionConstraints).forceSwitch.map((v: unknown) => v === true) : null };
  const changes: { subject: string; field: string; before: unknown; after: unknown; provenance: 'derived' }[] = [];
  if (previous) {
    const old = rows(previous.snapshot.pokemon);
    for (const p of pokemon) {
      const prior = old.find(row => row.id === p.id);
      for (const key of Object.keys(p)) {
        if (!prior || JSON.stringify(prior[key]) !== JSON.stringify(record(p)[key])) changes.push({ subject: p.id, field: key,
          before: prior?.[key] ?? null, after: record(p)[key], provenance: 'derived' });
      }
    }
    for (const oldPokemon of old) if (!pokemon.some(p => p.id === oldPokemon.id)) changes.push({ subject: oldPokemon.id, field: 'participating', before: true, after: false, provenance: 'derived' });
    for (const key of ['field', 'sideConditions', 'megaSpent']) if (JSON.stringify(previous.snapshot[key]) !== JSON.stringify(record(snapshot)[key])) {
      changes.push({ subject: 'battle', field: key, before: previous.snapshot[key] ?? null, after: record(snapshot)[key], provenance: 'derived' });
    }
  }
  const logHash = requestHash(authorizedLog);
  const memory: BattleMemoryState = { version: TEAM_CONTEXT_VERSION, battleId: observed.request.battleId, ourSide: observed.ourSide,
    logLength: authorizedLog.length, logHash, snapshot };
  const currentChanges = changes.filter(change => change.subject === 'battle' || pokemon.some(p => p.id === change.subject));
  const context = { version: TEAM_CONTEXT_VERSION, observed: snapshot, hypotheses: [],
    interpretation: 'Current facts reconstructed from the authorized observation. Unknown PP and effect durations remain unknown; resource presence does not imply activation. Opposing stats and unrevealed moves are unknown.',
    changes: currentChanges.slice(-8), additionalChangesInCurrentSnapshot: Math.max(0, currentChanges.length - 8) };
  if (byteLength(context) > 16_000) throw new Error('Battle memory exceeds its explicit 16000-byte budget; no current facts were truncated.');
  const audit = { version: TEAM_CONTEXT_VERSION, inputKey: input.key, inputHash: requestHash(input), logHash,
    logLength: authorizedLog.length, previousLogLength: previous?.logLength ?? 0, snapshotHash: requestHash(snapshot),
    provenance: { snapshot: 'derived-from-canonical-authorized-observation', ownResources: 'own-request-or-authorized-set',
      opposingResources: 'public-event-or-authorized-open-team-sheet', changes: 'derived-current-vs-previous-snapshot' },
    newObservedEventIndices: authorizedLog.map((_, i) => i).slice(previous?.logLength ?? 0),
    changes, excludedIds: observed.excludedIds, contextBytes: byteLength(context) };
  return { context, audit, memory };
}
