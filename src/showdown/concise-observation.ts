import { createHash } from 'node:crypto';
import type { DecisionInput } from './types.js';

type RecordValue = Record<string, unknown>;
const record = (value: unknown): RecordValue => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {};
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const strings = (value: unknown): string[] => list(value).filter((item): item is string => typeof item === 'string');
const numeric = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;
const stats = (value: unknown, keys: string[]) => {
  if (value === null || value === undefined) return null;
  const source = record(value);
  return Object.fromEntries(keys.map(key => [key, numeric(source[key])]));
};
const effects = (value: unknown) => list(value).map(record).map(effect => ({
  name: effect.name, sinceTurn: numeric(effect.sinceTurn), remainingTurns: numeric(effect.remainingTurns),
}));
const isPublicEvent = (line: string) => !/[\r\n]/.test(line) && /^\|(?:turn|move|cant|faint|switch|drag|replace|detailschange|-[^|]+)\|/.test(line);

/**
 * A model view of authorized observation only. Command generation, disclosure,
 * freshness and the full evidence ledger remain the caller's responsibility.
 * Nothing from audit belongs in the model request.
 */
export function projectObservation(input: DecisionInput): { battle: RecordValue; audit: RecordValue } {
  const state = input.state;
  if (!Array.isArray(state.pokemon)) throw new Error('An observation must contain its authorized Pokemon participants.');
  const request = record(state.request);
  const preview = input.phase === 'team-preview';
  const ourSide = typeof request.ourSide === 'string' ? request.ourSide : 'p2';
  const names = record(state.entityNames);
  const name = (id: string) => typeof names[id] === 'string' ? names[id] as string : id.replace(/^[^:]+:/, '');
  const entity = (id: unknown) => typeof id === 'string' ? { id, name: name(id) } : { knowledge: 'unknown' };
  const constraints = record(state.actionConstraints);
  const activeRequests = list(constraints.active);
  const sourcePokemon = state.pokemon.map(record).sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const noninitialPreview = preview && (list(state.field).length > 0 || Object.values(record(state.sideConditions)).some(value => list(value).length > 0)
    || sourcePokemon.some(pokemon => pokemon.fainted || pokemon.status || pokemon.megaEvolved || list(pokemon.effects).length || pokemon.lastMoveId || numeric(pokemon.slot) !== null
      || Object.values(record(pokemon.statStages)).some(value => typeof value === 'number' && value !== 0)
      || (numeric(record(pokemon.hp).percent) !== null && Number(record(pokemon.hp).percent) !== 100)));
  const includeDynamics = !preview || noninitialPreview;
  const warnings = new Set<string>();

  const participants = sourcePokemon.map(pokemon => {
    const own = pokemon.side === ourSide;
    const slot = numeric(pokemon.slot);
    const menu = !preview && own && slot !== null ? record(activeRequests[slot]) : {};
    const requestedMoves = list(menu.moves).map(record);
    const byMove = new Map(requestedMoves.filter(move => typeof move.moveId === 'string').map(move => [move.moveId as string, move]));
    const ppByMove = record(pokemon.movePP);
    const moveIds = [...new Set([...strings(pokemon.knownMoveIds), ...byMove.keys()])];
    const item = record(pokemon.item);
    const initial = record(pokemon.initialSetDetails);
    const mega = record(pokemon.availableMegaForm);
    const projected: RecordValue = {
      id: pokemon.id, side: own ? 'us' : 'opponent',
      species: typeof pokemon.speciesId === 'string' ? name(pokemon.speciesId) : 'unknown',
      speciesId: pokemon.speciesId, name: pokemon.name,
      level: numeric(pokemon.level), gender: pokemon.gender ?? null,
      types: strings(pokemon.typeIds).map(id => name(id)),
      ability: entity(pokemon.abilityId),
      item: item.status === 'known' ? { status: 'known', ...entity(item.cardId) } : { status: item.status === 'none' ? 'none' : 'unknown' },
      trainedStats: stats(pokemon.stats, ['hp', 'atk', 'def', 'spa', 'spd', 'spe']),
      moves: moveIds.map(id => {
        const move: RecordValue = { id, name: name(id) };
        if (includeDynamics) {
          const available = byMove.get(id);
          const pp = record(ppByMove[id]);
          const last = record(pp.lastObserved);
          const stale = pp.source === 'unconfirmed-since-request';
          // For old snapshots, active request PP is authoritative. A bare stored
          // number without that request or freshness evidence is historical only.
          const current = stale ? null : available && numeric(available.pp) !== null ? numeric(available.pp)
            : pp.source === 'current-request' ? numeric(pp.current) : null;
          const lastKnown = numeric(last.current) ?? numeric(pp.current);
          move.pp = {
            current, max: numeric(available?.maxPP) ?? numeric(pp.max),
            evidence: current !== null ? 'own request' : lastKnown !== null ? 'last observation; current PP unknown' : 'unknown',
            ...(current === null && lastKnown !== null ? { lastKnown: { current: lastKnown, turn: numeric(last.turn) } } : {}),
          };
          if (stale || (current === null && lastKnown !== null)) warnings.add('Historical own PP is not presented as an exact current value.');
          if (available) move.request = {
            disabled: Boolean(available.disabled), target: available.target ?? null,
          };
        }
        return move;
      }),
    };
    // Nature can affect flavor berries; training points are redundant with the
    // disclosed trained statistics, including the separate future Mega stats.
    if (typeof initial.nature === 'string') projected.nature = initial.nature;
    if (typeof mega.speciesId === 'string') projected.availableMegaForm = {
      species: name(mega.speciesId), speciesId: mega.speciesId,
      types: strings(mega.typeIds).map(id => name(id)), ability: entity(mega.abilityId),
      trainedStats: stats(mega.unmodifiedStats, ['hp', 'atk', 'def', 'spa', 'spd', 'spe']),
      condition: 'Disclosed possible transformation; it is not an opposing commitment.',
    };
    if (includeDynamics) {
      const hp = record(pokemon.hp); const exact = record(hp.exact);
      projected.hp = own && numeric(exact.current) !== null && numeric(exact.max) !== null
        ? { current: exact.current, max: exact.max, evidence: 'own exact HP' }
        : { percent: numeric(hp.percent), evidence: numeric(hp.percent) === null ? 'unknown' : 'public HP display; rounded, not exact HP' };
      projected.status = pokemon.status ?? null;
      projected.fainted = Boolean(pokemon.fainted);
      projected.statStages = stats(pokemon.statStages, ['atk', 'def', 'spa', 'spd', 'spe', 'accuracy', 'evasion']);
      projected.effects = effects(pokemon.effects);
      projected.entry = { turn: numeric(pokemon.enteredTurn), firstActionOpportunity: pokemon.firstActionOpportunity ?? null };
      projected.protectChain = numeric(pokemon.protectChain);
      projected.megaEvolved = Boolean(pokemon.megaEvolved);
      if (typeof pokemon.lastMoveId === 'string') projected.lastMove = { ...entity(pokemon.lastMoveId), turn: numeric(pokemon.lastMoveTurn) };
      const lost = record(pokemon.lastItemLoss);
      if (typeof lost.itemId === 'string') projected.lastItemLoss = {
        ...entity(lost.itemId), turn: numeric(lost.turn), consumed: typeof lost.consumed === 'boolean' ? lost.consumed : null,
      };
      if (Object.keys(menu).length) projected.request = {
        trapped: Boolean(menu.trapped), maybeTrapped: Boolean(menu.maybeTrapped), canMegaEvolve: Boolean(menu.canMegaEvolve),
      };
    }
    return projected;
  });

  const mode = record(state.informationPolicy).mode;
  const battle: RecordValue = {
    phase: input.phase, turn: numeric(request.turn), format: state.formatId,
    information: {
      sets: mode === 'revealed-demo' ? 'Own sets and opposing initial sets are explicitly disclosed.' : 'Only own sets and publicly revealed opposing facts are known.',
      opponentSelection: 'Four selected identities are disclosed without their order or leads before play.',
      unknown: 'Unknown is not absent. Trained stats are unmodified; apply stages and active effects once. Opposing pending choices and future outcomes are unknown.',
      ...(preview && !noninitialPreview ? { initialState: 'Fresh battle team preview supplied by the adapter. Format initialization gives full HP and PP, without status, boosts or field effects; this follows initialization rules, not missing observations. Opposing lead order is unknown.' } : {
        history: 'Retained public history supplements counters and effect durations that are not fully reconstructed. Null remainingTurns is unknown, not indefinite.',
        choices: 'The complete joint choices are provided separately. Availability does not guarantee success; the request menu may include moves that cannot currently be chosen.',
      }),
    },
    participants,
  };
  if (includeDynamics) {
    const sideConditions = record(state.sideConditions);
    const summarizeSide = (own: boolean) => {
      const members = sourcePokemon.filter(pokemon => (pokemon.side === ourSide) === own);
      return {
        active: members.filter(pokemon => numeric(pokemon.slot) !== null).sort((a, b) => Number(a.slot) - Number(b.slot)).map(pokemon => ({
          position: Number(pokemon.slot) === 0 ? 'left' : 'right', id: pokemon.id,
        })),
        reserves: members.filter(pokemon => pokemon.slot === null && !pokemon.fainted).map(pokemon => pokemon.id),
        fainted: members.filter(pokemon => pokemon.fainted).map(pokemon => pokemon.id),
        currentlyFaintedCount: members.filter(pokemon => pokemon.fainted).length,
        cumulativeFaintEvents: null,
        megaSpent: members.some(pokemon => pokemon.megaEvolved),
        effects: effects(sideConditions[own ? ourSide : ourSide === 'p2' ? 'p1' : 'p2']),
      };
    };
    battle.sides = { us: summarizeSide(true), opponent: summarizeSide(false) };
    battle.field = effects(state.field);
    if (input.phase === 'replacement') battle.replacement = {
      requestedPositions: list(constraints.forceSwitch).flatMap((required, slot) => required ? [slot === 0 ? 'left' : 'right'] : []),
      timing: 'Use public history for mid-turn versus end-of-turn timing; a replacement alone does not advance the turn.',
    };
    warnings.add('Cumulative faint events, sleep checks, choice locks and exact remaining durations are not fully modeled; current fainted participants and retained public history are preserved.');
  }
  const publicEvents = strings(state.recentPublicEvents).filter(isPublicEvent);
  const moves = list(state.moveHistory).map(record).map(event => ({
    turn: numeric(event.turn), actorId: event.actorId, move: entity(event.moveId), targetId: event.targetId ?? null,
  }));
  if (publicEvents.length || moves.length) battle.publicHistory = { events: publicEvents, moves, coverage: 'Recent window, not the complete battle log.' };
  const audit: RecordValue = {
    schemaVersion: 'concise-observation-v1', sourceKey: input.key,
    request: { battleId: request.battleId ?? null, rqid: request.rqid ?? null, ourSide },
    candidateCount: input.candidates.length,
    candidateDigest: createHash('sha256').update(JSON.stringify(input.candidates.map(action => ({ id: action.id, command: action.command })))).digest('hex'),
    setEvidence: sourcePokemon.map(pokemon => ({ id: pokemon.id, set: record(pokemon.provenance).set, dynamics: record(pokemon.provenance).dynamics })),
    omissions: ['Transport identifiers', 'Repeated provenance', 'Training points', 'Duplicate selection lists', ...(preview && !noninitialPreview ? ['Initial dynamic placeholders'] : [])],
    limitations: [...warnings],
  };
  return { battle, audit };
}
