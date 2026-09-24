import assert from 'node:assert/strict';
import type { DisclosedOpponentSelection } from '../context-v6/observation.js';
import { loadEngine } from '../showdown/engine.js';

const id = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
/** Validate the disclosure even when an unsupported mutation prevents canonical replay. */
export async function validateLiveDisclosure(log: readonly string[], ownSide: 'p1' | 'p2', battleId: string | undefined,
  disclosure?: DisclosedOpponentSelection) {
  if (!disclosure) return undefined;
  assert.equal(disclosure.kind, 'confirmed-unordered-selection', 'Unknown selection disclosure policy.');
  assert.equal(disclosure.battleId, battleId, 'Selection disclosure belongs to another battle.');
  assert.equal(disclosure.side, ownSide === 'p1' ? 'p2' : 'p1', 'Selection disclosure must identify the opponent.');
  assert.ok(Array.isArray(disclosure.names) && disclosure.names.length === 4 && disclosure.names.every(name => typeof name === 'string' && name.trim())
    && new Set(disclosure.names.map(id)).size === 4, 'Selection disclosure requires four distinct public species names.');
  const sheets = log.filter(line => line.startsWith(`|showteam|${disclosure.side}|`));
  assert.equal(sheets.length, 1, 'Selection disclosure requires exactly one authorized opposing Open Team Sheet.');
  const engine = await loadEngine();
  const sets = engine.Teams.unpack(sheets[0]!.split('|').slice(3).join('|')) as { name: string; species: string }[];
  const names = disclosure.names.map(name => {
    const candidates = sets.filter(set => id(set.species) === id(name) || id(set.name) === id(name));
    assert.equal(candidates.length, 1, `Disclosed species ${name} is absent or ambiguous in its public Open Team Sheet.`);
    return candidates[0]!.species;
  }).sort();
  assert.equal(new Set(names).size, 4, 'Selection disclosure aliases repeat a species.');
  return { kind: disclosure.kind, side: disclosure.side, names,
    provenance: 'Human-confirmed unordered species disclosure under the explicit local match policy; no lead order or pending action was disclosed.' };
}

/** No privacy, malformed input, stale request or programmer error may trigger this route. */
export function isUnsupportedHistory(error: unknown): boolean {
  return error instanceof Error && /^Observation bridge does not reconstruct (?:event (?:replace|swap|-transform|-swapboost|-copyboost|-swapsideconditions|-primal|-burst|-terastallize|-center|-combine)|effect (?:typechange|typeadd|transform|illusion))\.$/i.test(error.message);
}
