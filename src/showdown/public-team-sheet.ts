import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { formatId, labPath, showdownPath } from './engine.js';

const require = createRequire(import.meta.url);
let publicDex: any;

/** Lazy and synchronous because player-stream receive() is synchronous. */
function pinnedPublicDex(): any {
  if (!publicDex) {
    const lock = JSON.parse(readFileSync(resolve(labPath, 'showdown.lock.json'), 'utf8'));
    const revision = readFileSync(resolve(showdownPath, '.codex-pinned-revision'), 'utf8').trim();
    assert.equal(revision, lock.server.revision, 'Public team sheet validation requires the pinned Showdown revision.');
    publicDex = require(resolve(showdownPath, 'dist/sim/dex.js')).Dex.forFormat(formatId);
  }
  return publicDex;
}

const packedName = (value: string) => value.replace(/[^A-Za-z0-9]+/g, '');
const token = /^[A-Za-z0-9]+$/;

/**
 * Validate the exact packed public-OTS grammar emitted by the pinned Champions
 * Reg M-C engine. This is deliberately NOT Teams.unpack: unpack also accepts
 * JSON/full private sets, ignores surplus subfields and supplies private defaults.
 *
 * The original bytes are either accepted unchanged or explicitly rejected.
 * This does not authenticate a sender or authorize OTS in closed-sheet formats.
 */
export function validatePublicTeamSheetLine(line: string): void {
  function fail(condition: unknown, reason: string): asserts condition {
    assert.ok(condition, `Unsafe public team sheet: ${reason}`);
  }
  fail(typeof line === 'string' && !/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/u.test(line), 'control characters are forbidden.');
  const match = /^\|showteam\|(p[12])\|(.+)$/.exec(line);
  fail(match, 'expected one showteam event for p1 or p2.');
  const payload = match[2]!;
  fail(!/^[\s]*[\[{]/.test(payload), 'JSON/full team objects are not public packed sheets.');
  const sets = payload.split(']');
  fail(sets.length >= 1 && sets.length <= 6 && sets.every(Boolean), 'expected one to six complete packed public sets.');
  const dex = pinnedPublicDex();
  for (const [index, set] of sets.entries()) {
    const prefix = `set ${index + 1}`;
    const fields = set.split('|');
    fail(fields.length === 12, `${prefix} must contain exactly twelve fields; extra or missing fields are forbidden.`);
    const [name, speciesField, item, ability, moves, nature, evs, gender, ivs, shiny, level, misc] = fields as [string, string, string, string, string, string, string, string, string, string, string, string];
    // Battle.showOpenTeamSheets resets nickname to ''. Teams.pack consequently
    // emits the species as field 0 and leaves the separate species field empty.
    fail(speciesField === '', `${prefix} contains a nickname or an unexpected species field.`);
    fail(evs === '', `${prefix} contains private training/EV values, including explicit zero defaults.`);
    fail(ivs === '', `${prefix} contains private IV values, including explicit 31 defaults.`);
    fail(shiny === '', `${prefix} contains an unshared shiny field.`);
    fail(misc === '', `${prefix} contains private happiness or unsupported packed extensions.`);
    fail(gender === '' || gender === 'M' || gender === 'F', `${prefix} has an invalid public gender.`);
    fail(level === '' || (/^[1-9]\d{0,3}$/.test(level) && Number(level) !== 100), `${prefix} has a noncanonical public level.`);

    const species = dex.species.get(name);
    fail(species.exists && [species.name, species.id, packedName(species.name)].some(value => value.toLowerCase() === name.toLowerCase()),
      `${prefix} must identify a recognized species/form without arbitrary text.`);
    fail(item === '' || (token.test(item) && dex.items.get(item).exists), `${prefix} has an invalid packed public item.`);
    fail(token.test(ability) && dex.abilities.get(ability).exists, `${prefix} has an invalid packed public ability.`);
    const alignment = dex.natures.get(nature);
    fail(alignment.exists && alignment.name.toLowerCase() === nature.toLowerCase(), `${prefix} has an invalid public stat alignment.`);
    const moveIds = moves.split(',');
    fail(moveIds.length >= 1 && moveIds.length <= 4 && moveIds.every(move => token.test(move) && dex.moves.get(move).exists),
      `${prefix} must contain one to four recognized packed public moves.`);
    fail(new Set(moveIds.map(move => move.toLowerCase())).size === moveIds.length, `${prefix} contains repeated moves.`);
  }
}
