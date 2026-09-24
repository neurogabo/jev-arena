import type { DecisionInput } from '../showdown/types.js';

export const record = (v: unknown): Record<string, any> => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, any> : {};
export const strings = (v: unknown): string[] => Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
export const rows = (v: unknown): Record<string, any>[] => Array.isArray(v) ? v.map(record) : [];
export const finite = (v: unknown): number | null => typeof v === 'number' && Number.isFinite(v) ? v : null;
export const text = (v: unknown): string | null => typeof v === 'string' ? v : null;
export const byteLength = (v: unknown) => Buffer.byteLength(JSON.stringify(v), 'utf8');

/** Deliberately consumes the canonical player observation, never a Battle object. */
export function currentObservation(input: DecisionInput) {
  const request = record(input.state.request);
  if (request.ourSide !== 'p1' && request.ourSide !== 'p2') throw new Error('Team context requires an explicit controlled side.');
  if (typeof request.battleId !== 'string' || !request.battleId) throw new Error('Team context requires a battle identity.');
  const all = rows(input.state.pokemon);
  if (all.some(p => typeof p.id !== 'string' || !['p1', 'p2'].includes(p.side)) || new Set(all.map(p => p.id)).size !== all.length) {
    throw new Error('Canonical Pokemon must have unique stable identities and sides.');
  }
  const selected = strings(input.state.ownSelectedIds);
  const participants = all.filter(p => p.side !== request.ourSide || input.phase === 'team-preview' || !selected.length || selected.includes(p.id));
  const own = participants.filter(p => p.side === request.ourSide);
  if (own.length > (input.phase === 'team-preview' ? 6 : 4)) throw new Error('Current team exceeds its participant limit.');
  return { request, ourSide: request.ourSide as 'p1' | 'p2', pokemon: participants, own,
    excludedIds: all.filter(p => !participants.includes(p)).map(p => p.id as string) };
}

export function currentMove(input: DecisionInput, pokemon: Record<string, any>, moveId: string) {
  const active = rows(record(input.state.actionConstraints).active);
  const requestMove = Number.isInteger(pokemon.slot) ? rows(active[pokemon.slot]?.moves).find(m => m.moveId === moveId) : undefined;
  const observed = record(record(pokemon.movePP)[moveId]);
  const trusted = observed.source === 'current-request';
  return { pp: requestMove ? finite(requestMove.pp) : trusted ? finite(observed.current) : null,
    maxPP: requestMove ? finite(requestMove.maxPP) : trusted ? finite(observed.max) : null,
    disabled: requestMove ? Boolean(requestMove.disabled) : null,
    ppSource: requestMove || trusted ? 'current-request' : 'unknown',
    lastObserved: { pp: finite(record(observed.lastObserved).current), turn: finite(record(observed.lastObserved).turn) } };
}

export function resourceAvailability(input: DecisionInput, pokemon: Record<string, any> | undefined, kind: string, resourceId: string) {
  if (!pokemon) return { state: 'unavailable', reason: 'not-participating' };
  if (pokemon.fainted === true || record(pokemon.hp).percent === 0) return { state: 'unavailable', reason: 'fainted' };
  if (kind === 'move') {
    if (!strings(pokemon.knownMoveIds).includes(resourceId)) return { state: 'unavailable', reason: 'move-no-longer-known' };
    const move = currentMove(input, pokemon, resourceId);
    if (move.pp === 0) return { state: 'unavailable', reason: 'no-pp' };
    if (move.disabled) return { state: 'unavailable', reason: 'disabled-current-request' };
    return { state: move.pp === null ? 'conditional' : 'present', reason: move.pp === null ? 'pp-unconfirmed' : 'conditions-still-apply' };
  }
  if (kind === 'ability') {
    if (pokemon.abilityId !== resourceId) return { state: 'unavailable', reason: 'ability-changed-or-unknown' };
    if (rows(pokemon.effects).some(e => ['gastroacid', 'abilitysuppressed'].includes(String(e.name).toLowerCase().replace(/[^a-z]/g, '')))) {
      return { state: 'unavailable', reason: 'ability-suppressed' };
    }
    return { state: 'conditional', reason: 'ability-present-activation-and-suppression-conditions-apply' };
  }
  const item = record(pokemon.item);
  return item.status === 'known' && item.cardId === resourceId
    ? { state: 'conditional', reason: 'item-held-activation-conditions-apply' }
    : { state: 'unavailable', reason: item.status === 'none' ? 'item-no-longer-held' : 'item-changed-or-unknown' };
}
