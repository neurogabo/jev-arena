import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadTeamCatalog } from '../src/showdown/catalog.js';
import { labPath } from '../src/showdown/engine.js';
import { loadWiki } from '../src/wiki.js';
import { loadConciseKnowledge } from '../src/knowledge/concise.js';
import { ConfigSchema } from '../src/schema.js';

const config = ConfigSchema.parse(JSON.parse(await readFile(resolve(labPath, 'lab.config.json'), 'utf8')));
const wikiRoot = resolve(labPath, config.wikiPath);
const wiki = await loadWiki(wikiRoot);
await loadConciseKnowledge(wikiRoot, wiki);
const catalog = await loadTeamCatalog();
assert.ok(catalog.length > 0, 'Team catalog is empty.');
for (const entry of catalog) assert.ok(entry.sheet, `${entry.id}: ${entry.error}`);
console.log(`Verified ${wiki.index.length} knowledge cards and ${catalog.length} playable teams. No TypeSafe calls were made.`);
