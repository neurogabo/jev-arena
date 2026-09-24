import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';
import { digest } from '../wiki.js';
import type { Wiki } from '../wiki.js';
import type { DecisionInput } from '../showdown/types.js';
import { reviewedRules, optionalReminders } from './rules.js';
import type { RuleFacts } from './rules.js';

const revision = '2ddfa0476f8207e12e204b1c69f7c7683b17633c';
// Git can check out LF or CRLF. Lock source content after line-ending
// normalization, while retaining raw file hashes separately in the audit.
const sourceLocks = {
  'data/entities.json': 'dd90f65ebd50972eaf83a9e91c3b081f03f7f97f58243a2a72fe361e0a1740d8',
  'data/jev-cards.json': '6e3227af8f6d0869c4db668cf439299cfb766abacdcdb64aa098520f00b62f79',
};
const entitySchema = z.object({
  id: z.string(), name: z.string(), description: z.string().optional(),
  sources: z.array(z.string()).optional(), context_dependencies: z.array(z.string()).optional(),
}).passthrough();
type Entity = z.infer<typeof entitySchema>;
type Source = { cardId: string; articlePath: string; section: string; spanHash: string; engineRevision: string; engineRefs: string[] };
export type ConciseKnowledge = {
  wiki: Wiki; entities: Record<string, Entity>; sources: Record<string, Source>;
  sourceHashes: Record<string, string>;
};
const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
const shortId = (value: string) => value.includes(':') ? value.slice(value.indexOf(':') + 1) : value;
const frozenDetailConsumers = new Set(['revivalblessing','transform','mimic','sketch','copycat','mirrormove','mefirst','assist','metronome','instruct']);
const abilityCopyConsumers = new Set(['receiver','powerofalchemy','imposter','trace','wanderingspirit']);

/** The compiler is reviewed against this exact public snapshot; drift fails closed. */
export async function loadConciseKnowledge(wikiPath: string, wiki: Wiki): Promise<ConciseKnowledge> {
  if (wiki.manifest.showdownCommit !== revision) throw new Error('Concise rules require their reviewed Showdown revision.');
  const contents = await Promise.all(Object.keys(sourceLocks).map(file => readFile(resolve(wikiPath, file), 'utf8')));
  const sourceHashes = Object.fromEntries(Object.keys(sourceLocks).map((file, i) => [file, digest(contents[i]!)]));
  for (const [i, [file, expected]] of Object.entries(sourceLocks).entries()) {
    if (digest(contents[i]!.replace(/\r\n/g, '\n')) !== expected) throw new Error(`Concise knowledge source changed: ${file}. Re-review compiled rules before use.`);
  }
  const bundle = z.object({ environment: z.object({ format_id: z.string(), showdown_commit: z.string() }),
    pokemon: z.array(entitySchema), moves: z.array(entitySchema), abilities: z.array(entitySchema),
    items: z.array(entitySchema), types: z.array(entitySchema),
  }).parse(JSON.parse(contents[0]!.replace(/^\uFEFF/, '')));
  if (bundle.environment.format_id !== wiki.manifest.formatId || bundle.environment.showdown_commit !== revision) throw new Error('Concise entities and wiki use different environments.');
  const cards = JSON.parse(contents[1]!.replace(/^\uFEFF/, '')).cards as Wiki['cards'];
  for (const [id, card] of Object.entries(cards)) {
    if (wiki.cards[id]?.text !== card.text || wiki.cards[id]?.kind !== card.kind) throw new Error(`Wiki/card snapshot mismatch: ${id}`);
  }
  const catalog = JSON.parse(await readFile(resolve(wikiPath, 'catalog.json'), 'utf8'));
  if (wiki.manifest.hashes['catalog.json'] !== digest(await readFile(resolve(wikiPath, 'catalog.json'), 'utf8'))) throw new Error('Concise source catalogue changed after wiki load.');
  const sources: Record<string, Source> = {};
  for (const article of catalog.articles as { id: string; path: string; sources: string[] }[]) {
    if (!cards[article.id]) throw new Error(`Unknown source card: ${article.id}`);
    sources[article.id] = { cardId: article.id, articlePath: article.path, section: 'complete reviewed card',
      spanHash: digest(cards[article.id]!.text), engineRevision: revision, engineRefs: article.sources };
  }
  const entities: Record<string, Entity> = {};
  for (const [category, prefix] of [['pokemon','pokemon'],['moves','move'],['abilities','ability'],['items','item'],['types','type']] as const) {
    for (const entity of bundle[category]) {
      const id = `${prefix}:${entity.id}`;
      if (entities[id] || !cards[id]) throw new Error(`Invalid entity identity: ${id}`);
      entities[id] = entity;
    }
  }
  return { wiki: structuredClone(wiki), entities, sources, sourceHashes };
}

function entityDefinition(entity: Entity, kind: string) {
  if (kind === 'pokemon') return {
    name: entity.name, types: entity.types, weightKg: entity.weightkg,
    // Trained stats and current abilities are instance facts in the observation.
  };
  const excluded = new Set(['id','isNonstandard','summary','hooks','champions_override','context_dependencies',
    'sources','review_status','open_questions','availability','rating','pp','champions_pp']);
  return { ...Object.fromEntries(Object.entries(entity).filter(([key]) => !excluded.has(key))),
    ...(kind === 'move' ? { basePp: entity.pp, maximumPpInChampions: entity.champions_pp } : {}),
  };
}

export type ConciseAudit = {
  mandatoryIds: string[];
  omitted: { id: string; reason: string }[];
  sources: Record<string, Source>;
  rules: { id: string; sources: string[]; activation: string }[];
  fallbacks: { id: string; reason: string }[];
  sourceHashes: Record<string, string>;
  [key: string]: unknown;
};

/** Input is the original authorized observation, before the display projection. */
export function prepareConciseKnowledge(input: DecisionInput, knowledge: ConciseKnowledge) {
  if (input.state.formatId !== undefined && input.state.formatId !== knowledge.wiki.manifest.formatId) throw new Error('Concise decision format does not match the wiki.');
  if (!Array.isArray(input.state.pokemon) || input.state.pokemon.length === 0) throw new Error('Concise knowledge requires Pokemon observation records.');
  const pokemon = input.state.pokemon.map(record);
  const policy = record(input.state.informationPolicy);
  const closed = policy.mode === 'revealed-demo' && pokemon.every(p =>
    strings(p.knownMoveIds).length === 4 && typeof p.abilityId === 'string' &&
    ['known','none'].includes(String(record(p.item).status)));
  const conditionsKnown = Array.isArray(input.state.field) &&
    Array.isArray(record(input.state.sideConditions).p1) && Array.isArray(record(input.state.sideConditions).p2) &&
    pokemon.every(p => (p.status === null || typeof p.status === 'string') && Array.isArray(p.effects) && typeof p.fainted === 'boolean');
  const moveIds = new Set(pokemon.flatMap(p => strings(p.knownMoveIds)));
  const abilityIds = new Set(pokemon.flatMap(p => [p.abilityId, record(p.availableMegaForm).abilityId].filter((id): id is string => typeof id === 'string')));
  const effectText = JSON.stringify({
    field: input.state.field, sideConditions: input.state.sideConditions,
    pokemon: pokemon.map(p => ({ effects: p.effects, status: p.status })),
  }).toLowerCase();
  const canPruneFainted = closed && conditionsKnown &&
    ![...moveIds].some(id => frozenDetailConsumers.has(shortId(id))) &&
    ![...abilityIds].some(id => abilityCopyConsumers.has(shortId(id))) &&
    !/reviv|transform|copied|sketch|mimic|receiver|powerofalchemy/.test(effectText);
  const relevant = pokemon.filter(p => !canPruneFainted || p.fainted !== true);
  const omitted: ConciseAudit['omitted'] = pokemon.filter(p => !relevant.includes(p)).map(p => ({
    id: String(p.id), reason: 'Fainted member cannot act or return under these fully disclosed sets; compact faint identity remains, and field/side effects are selected independently.',
  }));
  const entityIds = new Set<string>();
  for (const p of relevant) {
    if (typeof p.speciesId === 'string') entityIds.add(p.speciesId);
    strings(p.knownMoveIds).forEach(id => entityIds.add(id));
    if (typeof p.abilityId === 'string') entityIds.add(p.abilityId);
    const item = record(p.item); if (item.status === 'known' && typeof item.cardId === 'string') entityIds.add(item.cardId);
    const mega = record(p.availableMegaForm);
    if (typeof mega.speciesId === 'string') entityIds.add(mega.speciesId);
    if (typeof mega.abilityId === 'string') entityIds.add(mega.abilityId);
  }
  // Request-supplied special moves such as forced Struggle are also executable.
  for (const id of input.requiredCardIds) if (id.startsWith('move:') && !moveIds.has(id)) entityIds.add(id);
  const definitions: Record<'pokemon' | 'moves' | 'abilities' | 'items', Record<string, unknown>> = { pokemon: {}, moves: {}, abilities: {}, items: {} };
  const included = new Set<string>();
  const fallbacks: ConciseAudit['fallbacks'] = [];
  const familyCandidates = new Set(input.requiredCardIds.filter(id => /^[CM]\d/.test(id)));
  const descriptions: string[] = [];
  for (const id of [...entityIds].sort()) {
    const entity = knowledge.entities[id];
    if (!entity) throw new Error(`Known entity lacks concise source data: ${id}`);
    const kind = id.split(':')[0]!;
    const bucket = ({ pokemon: 'pokemon', move: 'moves', ability: 'abilities', item: 'items' } as const)[kind as 'pokemon' | 'move' | 'ability' | 'item'];
    if (!bucket) throw new Error(`Unexpected concise entity kind: ${id}`);
    definitions[bucket]![id] = entityDefinition(entity, kind);
    included.add(id);
    descriptions.push(entity.description ?? '');
    (entity.context_dependencies ?? []).filter(id => /^[CM]\d/.test(id)).forEach(id => familyCandidates.add(id));
    if (strings(entity.hooks).length) fallbacks.push({ id, reason: 'Callback names are not executable semantics; complete source description retained with all serialized effect fields.' });
    if (strings(entity.open_questions).length) {
      definitions[bucket]![id] = { ...record(definitions[bucket]![id]), sourceLimitations: entity.open_questions };
      fallbacks.push({ id, reason: 'Source reports unresolved behavior; its limitations remain visible.' });
    }
  }
  const facts: RuleFacts = {
    moves: new Set([...entityIds].filter(id => id.startsWith('move:')).map(shortId)),
    moveTargets: new Set([...entityIds].filter(id => id.startsWith('move:')).map(id => String(knowledge.entities[id]!.target))),
    abilities: new Set([...entityIds].filter(id => id.startsWith('ability:')).map(shortId)),
    items: new Set([...entityIds].filter(id => id.startsWith('item:')).map(shortId)),
    statuses: new Set(pokemon.flatMap(p => typeof p.status === 'string' ? [p.status] : [])),
    effects: effectText, entityDescriptions: descriptions.join('\n'), closed: closed && conditionsKnown,
    mega: relevant.some(p => Boolean(p.availableMegaForm) || p.megaEvolved === true),
  };
  // Dire Claw's callback is not fully represented in serialized secondary data.
  if (facts.moves.has('direclaw')) facts.entityDescriptions += '\nCan cause poison, paralysis and sleep.';
  const rules: Record<string, string> = {};
  const ruleAudit: ConciseAudit['rules'] = [];
  const coveredSources = new Set(reviewedRules.flatMap(rule => rule.sources));
  for (const rule of reviewedRules) {
    const applies = !rule.applies || rule.applies(facts);
    if (applies || !facts.closed) {
      rules[rule.id] = rule.text;
      rule.sources.forEach(id => included.add(id));
      ruleAudit.push({ id: rule.id, sources: rule.sources, activation: applies ? 'present-or-reachable' : 'uncertain-open-information' });
    } else omitted.push({ id: rule.id, reason: 'Trigger absent from current effects and the closed disclosed sets; no matching reachable effect.' });
  }
  // A broad room family is only partly atomized. Preserve unusual room clauses.
  if (['gravity','trickroom','wonderroom','magicroom'].some(id => facts.moves.has(id) || facts.effects.includes(id))) {
    rules['rooms-source-fallback'] = knowledge.wiki.cards.M21!.text;
    included.add('M21'); fallbacks.push({ id: 'M21', reason: 'Non-Tailwind room behavior retains complete source until separately reviewed.' });
  }
  for (const id of [...familyCandidates].sort()) {
    if (coveredSources.has(id)) continue;
    const card = knowledge.wiki.cards[id];
    if (!card) throw new Error(`Required mechanic source is missing: ${id}`);
    rules[`source:${id}`] = card.text;
    included.add(id); fallbacks.push({ id, reason: 'Required family has no reviewed atom; retained source text, without recursively adding unrelated chapters.' });
  }
  // Direct status evidence can precede a matching known move or ability.
  // Its relevant reviewed rules are already activated by the observation above.
  const typeIds = new Set(relevant.flatMap(p => [
    ...strings(p.typeIds), ...strings(record(p.availableMegaForm).typeIds),
    ...strings(knowledge.entities[String(p.speciesId)]?.types).map(type => `type:${type.toLowerCase()}`),
  ]));
  const ordinaryTypeMatchups = Object.fromEntries([...typeIds].sort().map(id => {
    const entity = knowledge.entities[id];
    if (!entity) throw new Error(`Unknown observed defensive type: ${id}`);
    included.add(id);
    return [entity.name, entity.incoming_multiplier];
  }));
  included.add('C08');
  const activeRuleIds = new Set(Object.keys(rules));
  const complementary = optionalReminders.filter(note => activeRuleIds.has(note.rule) &&
    (note.id !== 'interaction:dark-prankster' || facts.abilities.has('prankster') || !closed))
    .map(({ id, title, text }) => ({ id, title, text }));
  const sources = Object.fromEntries([...new Set([...included, ...complementary.map(note => note.id)])].sort().map(id => {
    const source = knowledge.sources[id];
    if (!source) throw new Error(`Missing audit provenance for ${id}`);
    return [id, source];
  }));
  const audit: ConciseAudit = {
    mandatoryIds: [...included].sort(), omitted, sources, rules: ruleAudit, fallbacks,
    sourceHashes: knowledge.sourceHashes, formatId: knowledge.wiki.manifest.formatId, engineRevision: revision,
    closedInformation: closed, conditionInformationComplete: conditionsKnown, faintedDetailsPruned: canPruneFainted,
    optionalPolicy: 'Optional reminders duplicate mandatory semantics; rejecting all cannot remove a required rule.',
  };
  const currentFaintedBySide = Object.fromEntries(['p1', 'p2'].map(side => [side, pokemon.some(p => p.side === side && typeof p.fainted !== 'boolean') ? null : pokemon.filter(p => p.side === side && p.fainted === true).length]));
  const ourSide = record(input.state.request).ourSide;
  const opposingRemaining = relevant.filter(p => p.fainted !== true && (ourSide === 'p1' || ourSide === 'p2') && p.side !== ourSide);
  const damagingCategories = closed && conditionsKnown ? opposingRemaining.map(p => ({
    id: p.id, species: knowledge.entities[String(p.speciesId)]!.name,
    knownDamagingMoves: strings(p.knownMoveIds).map(id => knowledge.entities[id]!).filter(move => move.category === 'Physical' || move.category === 'Special')
      .map(move => ({ move: move.name, category: move.category })),
  })) : [];
  const categories = [...new Set(damagingCategories.flatMap(p => p.knownDamagingMoves.map(move => String(move.category))))].sort();
  const mandatory = {
    rules, ...definitions,
    computedFacts: {
      currentFaintedBySide,
      cumulativeFaintsBySide: canPruneFainted ? currentFaintedBySide : null,
      faintCountBasis: canPruneFainted ? 'Closed disclosed sets have no revival/copy path; each current faint represents one faint event.' : 'Revival/copy or unknown sets prevent equating current fainted members with historical faint events.',
      opposingKnownDamagingMoves: damagingCategories,
      opposingDamagingCategories: closed && conditionsKnown && opposingRemaining.length ? categories : null,
      categoryBasis: 'Resolved listed move categories of known remaining opponents; this is a lookup, not a move recommendation. Any explicit dynamic category exception in the move description still applies.',
    },
    ordinaryTypeMatchups,
    typeMatchupMeaning: 'Rows are current/available defensive types; entries give each attacking type’s ordinary factor. Multiply dual-type factors. Move/ability/immunity exceptions remain separate; this is not final damage.',
    faintedMembers: pokemon.filter(p => p.fainted === true).map(p => ({ id: p.id, side: p.side, speciesId: p.speciesId })),
    faintHistoryMeaning: 'These are currently fainted identities, not an invented count of all historical faint events after revival. Use the supplied battle faint-event history for Last Respects.',
    unknownMeaning: 'An absent optional rule is not an absent observation. Unknown ability/item/counter values stay unknown; source descriptions do not assert that their conditions currently hold.',
  };
  const expand = (selectedIds: string[]): Record<string, unknown> => {
    if (new Set(selectedIds).size !== selectedIds.length) throw new Error('Duplicate complementary knowledge selection.');
    return Object.fromEntries(selectedIds.map(id => {
      const note = complementary.find(candidate => candidate.id === id);
      if (!note) throw new Error(`Unoffered complementary rule: ${id}`);
      return [id, note.text];
    }));
  };
  return { mandatory, complementary, expand, audit };
}
