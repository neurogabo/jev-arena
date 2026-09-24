import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { z } from 'zod';
import type { Scenario, JointAction } from './schema.js';

const indexEntry = z.object({ id: z.string(), kind: z.string(), summary: z.string() });
const environment = z.object({ format_id: z.string(), showdown_commit: z.string() });
const edgeSchema = z.object({
  from: z.string(), to: z.string(), type: z.string(),
  condition: z.string().optional(), interaction: z.string().optional(),
});
export type Edge = z.infer<typeof edgeSchema>;
export type Card = { kind: string; text: string };
export type Wiki = {
  index: z.infer<typeof indexEntry>[];
  cards: Record<string, Card>;
  edges: Edge[];
  pokemonSections?: Record<string, { identity: string; builds: string; tactics: string }>;
  manifest: { version: string; formatId: string; showdownCommit: string; hashes: Record<string, string> };
};
const wikiFiles = ['catalog.json', 'data/jev-index.json', 'data/jev-cards.json', 'links.json'];
export const digest = (value: string) => createHash('sha256').update(value).digest('hex');

export function describeCandidate(wiki: Wiki, candidate: Wiki['index'][number]) {
  const text = wiki.cards[candidate.id]?.text;
  if (!text) throw new Error(`Candidate card is missing: ${candidate.id}`);
  const title = text.match(/^# (.+)$/m)?.[1]?.trim() ?? candidate.id;
  const whenToRetrieve = text.match(/^## When to retrieve\s*\n([\s\S]*?)(?=^## |$(?![\s\S]))/m)?.[1]?.trim();
  return { ...candidate, title, ...(whenToRetrieve ? { whenToRetrieve } : {}) };
}

export async function loadWiki(root: string): Promise<Wiki> {
  const files = [...wikiFiles];
  try {
    await stat(resolve(root, 'data/pokemon-sections.json'));
    files.push('data/pokemon-sections.json');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const paths = files.map(name => resolve(root, name));
  const before = await Promise.all(paths.map(path => stat(path)));
  const texts = await Promise.all(paths.map(path => readFile(path, 'utf8')));
  const after = await Promise.all(paths.map(path => stat(path)));
  for (let i = 0; i < paths.length; i++) {
    if (before[i]!.mtimeMs !== after[i]!.mtimeMs || before[i]!.size !== after[i]!.size) {
      throw new Error(`Wiki changed while reading ${files[i]}; retry with a completed snapshot.`);
    }
  }
  const parsed: unknown[] = texts.map(text => JSON.parse(text.replace(/^\uFEFF/, '')));
  const catalog = z.object({
    wiki_version: z.string(), environment,
    articles: z.array(z.object({ id: z.string(), kind: z.string() })),
  }).parse(parsed[0]);
  const index = z.array(indexEntry).parse(parsed[1]);
  const bundle = z.object({
    schema_version: z.literal(1), format_id: z.string(),
    cards: z.record(z.string(), z.object({ kind: z.string(), text: z.string().min(1) })),
  }).parse(parsed[2]);
  const graph = z.object({ environment, edges: z.array(edgeSchema) }).parse(parsed[3]);
  const sections = parsed[4] === undefined ? undefined : z.object({
    schema_version: z.literal(1), format_id: z.string(),
    sections: z.record(z.string(), z.object({ identity: z.string().min(1), builds: z.string(), tactics: z.string() })),
  }).parse(parsed[4]);
  if (bundle.format_id !== catalog.environment.format_id || graph.environment.format_id !== bundle.format_id ||
      graph.environment.showdown_commit !== catalog.environment.showdown_commit) {
    throw new Error('Wiki files refer to different formats or simulator revisions.');
  }
  if (sections && sections.format_id !== bundle.format_id) throw new Error('Pokemon sections use a different format.');
  const catalogue = new Map(catalog.articles.map(article => [article.id, article.kind]));
  if (catalogue.size !== catalog.articles.length || new Set(index.map(entry => entry.id)).size !== index.length ||
      index.length !== catalogue.size || Object.keys(bundle.cards).length !== catalogue.size) {
    throw new Error('Wiki IDs are duplicated or file entry counts do not match.');
  }
  for (const entry of index) {
    if (catalogue.get(entry.id) !== entry.kind || bundle.cards[entry.id]?.kind !== entry.kind) {
      throw new Error(`Wiki card/index mismatch: ${entry.id}`);
    }
    if (sections && entry.kind === 'pokemon' && !sections.sections[entry.id]) {
      throw new Error(`Missing Pokemon identity section: ${entry.id}`);
    }
  }
  for (const edge of graph.edges) for (const ref of [edge.from, edge.to, edge.interaction].filter(Boolean)) {
    if (!bundle.cards[ref!]) throw new Error(`Wiki edge refers to missing card: ${ref}`);
  }
  return {
    index, cards: bundle.cards, edges: graph.edges, pokemonSections: sections?.sections,
    manifest: {
      version: catalog.wiki_version, formatId: bundle.format_id,
      showdownCommit: catalog.environment.showdown_commit,
      hashes: Object.fromEntries(files.map((name, i) => [name, digest(texts[i]!)])),
    },
  };
}

export function seedIds(scenario: Scenario, actions: JointAction[], core: string[]): string[] {
  const ids = new Set(core);
  for (const p of scenario.pokemon) {
    [p.speciesId, ...p.typeIds, ...p.knownMoveIds, ...p.effects.map(e => e.cardId)].forEach(id => ids.add(id));
    if (p.abilityId) ids.add(p.abilityId);
    if (p.item.status === 'known') ids.add(p.item.cardId);
  }
  scenario.field.effects.forEach(e => ids.add(e.cardId));
  scenario.hypotheses.forEach(h => h.cardIds.forEach(id => ids.add(id)));
  for (const action of actions) for (const { command } of action.commands) if (command.kind === 'move') {
    ids.add(command.moveId);
    if (command.megaFormId) ids.add(command.megaFormId);
  }
  return [...ids].sort();
}

export function modelCard(wiki: Wiki, id: string, pokemonDetail: 'full' | 'identity' = 'full'): Card & { id: string } {
  const card = wiki.cards[id];
  if (!card) throw new Error(`Required wiki card is missing: ${id}`);
  // An entire legal learnset is not the observed four moves. Keep other sections
  // verbatim, including exceptions. Do not recursively load every bracketed ID.
  let text = card.text;
  if (card.kind === 'pokemon') {
    if (pokemonDetail === 'identity') {
      const section = wiki.pokemonSections?.[id]?.identity;
      // New unified cards require an explicit section boundary. Never fall back
      // to loading incompatible build candidates into a fully disclosed demo.
      if (!section) throw new Error(`Identity-only context requires a Pokemon section for ${id}.`);
      const heading = section.match(/^# [^\r\n]+/)?.[0] ?? `# ${id}`;
      const identityStart = section.search(/^## Identity and form\s*$/m);
      if (identityStart < 0) throw new Error(`Identity section boundary is missing: ${id}`);
      text = `${heading}\n\n${section.slice(identityStart).trim()}\n`;
      return { id, kind: card.kind, text };
    }
    text = text.replace(/^## Legal move references\r?\n[\s\S]*?(?=^## |$(?![\s\S]))/m,
      '## Move information\n\nKnown moves and available actions are supplied in battle state. The full learnset is omitted.\n\n');
  }
  return { id, kind: card.kind, text };
}

// Conservative dependency closure: a conditional dependency is included for
// interpretation, not asserted to be active. Never follow can_learn/can_have.
export function dependencyClosure(wiki: Wiki, roots: string[]) {
  const ids = new Set(roots);
  const reasons: Record<string, Edge[]> = {};
  const queue = [...roots];
  const byFrom = new Map<string, Edge[]>();
  for (const edge of wiki.edges) if (edge.type === 'requires_context') {
    const list = byFrom.get(edge.from) ?? [];
    list.push(edge);
    byFrom.set(edge.from, list);
  }
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const from = queue[cursor]!;
    modelCard(wiki, from);
    for (const edge of byFrom.get(from) ?? []) {
      (reasons[edge.to] ??= []).push(edge);
      if (!ids.has(edge.to)) { ids.add(edge.to); queue.push(edge.to); }
    }
  }
  return { ids: [...ids].sort(), reasons };
}

export function relevantRelations(wiki: Wiki, ids: string[]) {
  const included = new Set(ids);
  const allowed = new Set(['requires_context', 'blocks', 'bypasses', 'modifies', 'causes', 'can_trigger', 'can_transform_into']);
  // Many dependencies repeat the identical condition for several destinations.
  // Group them without deleting a condition or treating it as executable logic.
  const grouped = new Map<string, { from: string; to: string[]; type: string; condition?: string; interaction?: string }>();
  for (const edge of wiki.edges) {
    if (!included.has(edge.from) || !included.has(edge.to) || !allowed.has(edge.type)) continue;
    const { to, ...rest } = edge;
    const key = JSON.stringify(rest);
    const relation = grouped.get(key) ?? { ...rest, to: [] };
    if (!relation.to.includes(to)) relation.to.push(to);
    grouped.set(key, relation);
  }
  return [...grouped.values()];
}
