import type { DecisionInput } from '../showdown/types.js';
import type { ConciseKnowledge } from './concise.js';
import { reviewedRules, type RuleFacts } from './rules.js';

export type SelectiveBlock = {
  id: string; title: string; text: string; dependencies: string[]; sourceIds: string[];
  trigger: 'observed-or-reachable' | 'uncertain'; facts?: unknown;
};
const record = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
const shortId = (value: string) => value.includes(':') ? value.slice(value.indexOf(':') + 1) : value;
const sorted = (values: Iterable<string>) => [...new Set(values)].sort();
const copyMoves = new Set(['revivalblessing', 'transform', 'mimic', 'sketch', 'copycat', 'mirrormove', 'mefirst', 'assist', 'metronome', 'instruct']);
const copyAbilities = new Set(['receiver', 'powerofalchemy', 'imposter', 'trace', 'wanderingspirit']);
const ruleId = (id: string) => `rule:${id}`;

/** Source fields are copied, not model-written summaries. Callback names alone are not semantics. */
function entityFacts(entity: Record<string, unknown>, kind: string) {
  if (kind === 'pokemon') return { name: entity.name, types: entity.types, weightKg: entity.weightkg };
  const excluded = new Set(['id', 'isNonstandard', 'summary', 'hooks', 'champions_override', 'context_dependencies',
    'sources', 'review_status', 'open_questions', 'availability', 'rating', 'pp', 'champions_pp']);
  return {
    ...Object.fromEntries(Object.entries(entity).filter(([key]) => !excluded.has(key))),
    ...(kind === 'move' ? { basePp: entity.pp, maximumPpInChampions: entity.champions_pp } : {}),
    ...(strings(entity.open_questions).length ? { sourceLimitations: entity.open_questions } : {}),
  };
}

/**
 * Prepare candidates only. No rule is mandatory, no battle action is scored here,
 * and no unknown move/ability/item is replaced by a species-based guess.
 * Consumers must close dependencies and reject a budget overflow, never truncate blocks.
 */
export function prepareSelectiveKnowledge(input: DecisionInput, knowledge: ConciseKnowledge): {
  blocks: SelectiveBlock[]; audit: Record<string, unknown>;
} {
  if (input.state.formatId !== undefined && input.state.formatId !== knowledge.wiki.manifest.formatId) throw new Error('Selective decision format does not match the wiki.');
  if (!Array.isArray(input.state.pokemon) || !input.state.pokemon.length) throw new Error('Selective knowledge requires Pokemon observation records.');
  const pokemon = input.state.pokemon.map(record);
  const policy = record(input.state.informationPolicy);
  // A complete disclosed set can legitimately contain fewer than four moves.
  // Conversely, four observed moves alone are not an explicit completeness promise.
  const completeMoves = (p: Record<string, unknown>) => Array.isArray(p.knownMoveIds) &&
    (p.movesComplete === true || (policy.mode === 'revealed-demo' && p.movesComplete !== false));
  const closed = pokemon.every(p => completeMoves(p) && typeof p.abilityId === 'string' &&
    ['known', 'none'].includes(String(record(p.item).status)));
  const conditionsKnown = Array.isArray(input.state.field) &&
    Array.isArray(record(input.state.sideConditions).p1) && Array.isArray(record(input.state.sideConditions).p2) &&
    pokemon.every(p => (p.status === null || typeof p.status === 'string') && Array.isArray(p.effects) && typeof p.fainted === 'boolean');
  const allMoves = new Set(pokemon.flatMap(p => strings(p.knownMoveIds)));
  const allAbilities = new Set(pokemon.flatMap(p => [p.abilityId, record(p.availableMegaForm).abilityId].filter((id): id is string => typeof id === 'string')));
  const namedEffects = [input.state.field, record(input.state.sideConditions).p1, record(input.state.sideConditions).p2,
    ...pokemon.map(p => p.effects)].flatMap(value => Array.isArray(value) ? value : [])
    .map(value => String(record(value).name ?? '').toLowerCase().replace(/[^a-z0-9]/g, ''));
  // Protocol labels include spaces and prefixes ("move: Trick Room").
  // Preserve original observations while matching canonical mechanic names.
  const effects = `${JSON.stringify({ field: input.state.field, sideConditions: input.state.sideConditions,
    pokemon: pokemon.map(p => ({ effects: p.effects, status: p.status })) }).toLowerCase()}\n${namedEffects.join('\n')}`;
  const canPruneFainted = input.phase !== 'team-preview' && closed && conditionsKnown &&
    ![...allMoves].some(id => copyMoves.has(shortId(id))) && ![...allAbilities].some(id => copyAbilities.has(shortId(id))) &&
    !/reviv|transform|copied|sketch|mimic|receiver|powerofalchemy/.test(effects);
  const relevant = pokemon.filter(p => !canPruneFainted || p.fainted !== true);
  const entityIds = new Set<string>();
  for (const p of relevant) {
    if (typeof p.speciesId === 'string') entityIds.add(p.speciesId);
    strings(p.knownMoveIds).filter(id => id !== 'move:recharge').forEach(id => entityIds.add(id));
    if (typeof p.abilityId === 'string') entityIds.add(p.abilityId);
    const item = record(p.item);
    if (item.status === 'known' && typeof item.cardId === 'string') entityIds.add(item.cardId);
    const mega = record(p.availableMegaForm);
    if (typeof mega.speciesId === 'string') entityIds.add(mega.speciesId);
    if (typeof mega.abilityId === 'string') entityIds.add(mega.abilityId);
  }
  // A special request move (for example Struggle) need not belong to any original set.
  for (const id of input.requiredCardIds) if (id.startsWith('move:') && id !== 'move:recharge' && !allMoves.has(id)) entityIds.add(id);
  const familyCandidates = new Set(input.requiredCardIds.filter(id => /^[CM]\d/.test(id)));
  const blocks: SelectiveBlock[] = [];
  const fallbacks: { id: string; reason: string }[] = [];
  const descriptions: string[] = [];
  const entityById = new Map<string, Record<string, unknown>>();
  for (const id of sorted(entityIds)) {
    const entity = knowledge.entities[id];
    if (!entity) throw new Error(`Known entity lacks selective source data: ${id}`);
    const kind = id.split(':')[0]!;
    if (!['pokemon', 'move', 'ability', 'item'].includes(kind)) throw new Error(`Unexpected selective entity kind: ${id}`);
    entityById.set(id, entity);
    descriptions.push(entity.description ?? '');
    (entity.context_dependencies ?? []).filter(source => /^[CM]\d/.test(source)).forEach(source => familyCandidates.add(source));
    const facts = entityFacts(entity, kind);
    blocks.push({ id: `entity:${id}`, title: `${entity.name}: ${kind} facts`,
      text: kind === 'pokemon' ? 'Species identity, not trained statistics.' : 'Apply effects only when their stated conditions hold.',
      dependencies: [], sourceIds: [id], trigger: 'observed-or-reachable', facts });
    if (strings(entity.hooks).length || strings(entity.open_questions).length) fallbacks.push({ id,
      reason: 'Retained complete source description and serialized effect fields, including source limitations; callback names are not executable semantics.' });
  }
  const facts: RuleFacts = {
    moves: new Set([...entityIds].filter(id => id.startsWith('move:')).map(shortId)),
    moveTargets: new Set([...entityIds].filter(id => id.startsWith('move:')).map(id => String(entityById.get(id)!.target))),
    abilities: new Set([...entityIds].filter(id => id.startsWith('ability:')).map(shortId)),
    items: new Set([...entityIds].filter(id => id.startsWith('item:')).map(shortId)),
    statuses: new Set(relevant.flatMap(p => typeof p.status === 'string' ? [p.status] : [])),
    effects, entityDescriptions: descriptions.join('\n'), closed: closed && conditionsKnown,
    mega: relevant.some(p => Boolean(p.availableMegaForm) || p.megaEvolved === true),
  };
  if (facts.moves.has('direclaw')) facts.entityDescriptions += '\nCan cause poison, paralysis and sleep.';
  const omitted: { id: string; reason: string }[] = pokemon.filter(p => !relevant.includes(p)).map(p => ({ id: String(p.id),
    reason: 'Fainted details cannot become actionable under explicitly complete sets without a revival/copy path. Faint identity and event history remain in the state.' }));
  for (const rule of reviewedRules) {
    const applies = !rule.applies || rule.applies(facts);
    if (applies || !facts.closed) blocks.push({ id: ruleId(rule.id), title: rule.id.replace(/-/g, ' '), text: rule.text,
      dependencies: [], sourceIds: [...rule.sources], trigger: applies ? 'observed-or-reachable' : 'uncertain' });
    else omitted.push({ id: ruleId(rule.id), reason: 'No trigger in explicitly complete sets or observed conditions.' });
  }
  const coveredSources = new Set(reviewedRules.flatMap(rule => rule.sources));
  const addSource = (id: string, trigger: SelectiveBlock['trigger']) => {
    if (blocks.some(block => block.id === `source:${id}`)) return;
    const card = knowledge.wiki.cards[id];
    if (!card) throw new Error(`Selective mechanic source is missing: ${id}`);
    blocks.push({ id: `source:${id}`, title: card.text.match(/^# (.+)$/m)?.[1]?.trim() ?? id, text: card.text, dependencies: [], sourceIds: [id], trigger });
    fallbacks.push({ id, reason: 'Mechanic is not fully atomized; exact source retained as a selectable block.' });
  };
  for (const id of sorted(familyCandidates)) if (!coveredSources.has(id)) addSource(id, 'observed-or-reachable');
  // Broad room and terrain chapters contain exceptions not covered by reviewed core rules.
  const roomReachable = ['gravity', 'trickroom', 'wonderroom', 'magicroom'].some(id => facts.moves.has(id) || facts.effects.includes(id));
  if (roomReachable || !facts.closed) addSource('M21', roomReachable ? 'observed-or-reachable' : 'uncertain');
  const terrainReachable = /terrain|surge|seed|rising voltage|expanding force/i.test(`${facts.effects}\n${facts.entityDescriptions}`);
  if (terrainReachable || !facts.closed) addSource('M16', terrainReachable ? 'observed-or-reachable' : 'uncertain');
  const typeIds = sorted(relevant.flatMap(p => [...strings(p.typeIds), ...strings(record(p.availableMegaForm).typeIds),
    ...strings(knowledge.entities[String(p.speciesId)]?.types).map(type => `type:${type.toLowerCase()}`)]));
  if (typeIds.length) {
    const matchups = Object.fromEntries(typeIds.map(id => {
      const entity = knowledge.entities[id];
      if (!entity) throw new Error(`Unknown observed defensive type: ${id}`);
      return [entity.name, entity.incoming_multiplier];
    }));
    blocks.push({ id: 'facts:type-matchups', title: 'Ordinary type factors for observed and available forms',
      text: 'Rows are defensive types; entries give attacking type factors. Multiply dual-type factors. These are not final damage and do not override move, ability, protection or grounding exceptions.',
      facts: matchups, dependencies: [ruleId('type-and-status-immunities')], sourceIds: ['C08', ...typeIds], trigger: 'observed-or-reachable' });
  }
  const byId = new Map(blocks.map(block => [block.id, block]));
  const depend = (id: string, ...dependencies: string[]) => {
    const block = byId.get(id);
    if (!block) return;
    for (const dependency of dependencies) {
      if (!byId.has(dependency)) throw new Error(`Selective block ${id} lacks dependency ${dependency}.`);
      if (!block.dependencies.includes(dependency)) block.dependencies.push(dependency);
    }
  };
  // Couple concrete priorities to their meaning, without choosing an action.
  const order = byId.get(ruleId('action-order'))!;
  const priorities = [...entityById].filter(([id]) => id.startsWith('move:')).map(([id, entity]) => ({ id, name: entity.name, basePriority: entity.priority }));
  const priorityModifiers = [...entityById].filter(([id, entity]) => /^(ability|item):/.test(id) && /priority|moves? (?:first|last)|move order/i.test(String(entity.description)));
  order.text = `Known move base priorities: ${priorities.map(p => `${p.name} ${Number(p.basePriority) > 0 ? '+' : ''}${p.basePriority}`).join('; ')}. ${order.text}`;
  order.facts = { knownMovePriorities: priorities, meaning: 'Base priority lookup, not a forecast of the opponent command. Applicable effective ability/item conditions can modify it.' };
  order.sourceIds.push(...priorities.map(p => p.id));
  if (priorityModifiers.length) {
    order.text += ` Applicable known definitions (conditional): ${priorityModifiers.map(([, entity]) => `${entity.name}: ${entity.description}`).join(' ')}`;
    order.sourceIds.push(...priorityModifiers.map(([id]) => id));
  }
  if (byId.has('source:M16')) depend(order.id, 'source:M16');
  if (roomReachable) depend(order.id, 'source:M21');
  depend('source:M16', ruleId('type-and-status-immunities'));
  depend(ruleId('dire-claw-statuses'), ruleId('poison'), ruleId('paralysis'), ruleId('sleep'), ruleId('type-and-status-immunities'));
  depend('entity:move:direclaw', ruleId('dire-claw-statuses'));
  for (const status of ['burn', 'poison', 'paralysis', 'sleep', 'freeze']) depend(ruleId(status), ruleId('type-and-status-immunities'));
  for (const guard of ['personal-protection', 'side-guards']) depend(ruleId(guard), order.id, ruleId('targets'));
  if (byId.has(ruleId('side-guards'))) depend(ruleId('spread'), ruleId('side-guards'));
  depend(ruleId('spread'), ruleId('targets'));
  for (const move of ['protect', 'detect', 'feint', 'spikyshield', 'kingsshield', 'banefulbunker', 'silktrap', 'burningbulwark', 'endure']) depend(`entity:move:${move}`, ruleId('personal-protection'));
  for (const move of ['quickguard', 'wideguard']) depend(`entity:move:${move}`, ruleId('side-guards'));
  for (const move of ['fakeout', 'firstimpression', 'struggle']) depend(`entity:move:${move}`, ruleId('choice-and-first-action'));
  depend('entity:ability:prankster', ruleId('type-and-status-immunities'));
  for (const id of ['entity:item:airballoon', 'entity:item:ironball', 'entity:ability:levitate']) depend(id, ruleId('type-and-status-immunities'));
  for (const block of blocks) { block.sourceIds = sorted(block.sourceIds); block.dependencies.sort(); }
  const sources = Object.fromEntries(sorted(blocks.flatMap(block => block.sourceIds)).map(id => {
    const source = knowledge.sources[id];
    if (!source) throw new Error(`Missing selective audit provenance for ${id}`);
    return [id, source];
  }));
  return { blocks: blocks.sort((a, b) => a.id.localeCompare(b.id)), audit: {
    version: 'selective-v3', formatId: knowledge.wiki.manifest.formatId, engineRevision: knowledge.wiki.manifest.showdownCommit,
    sourceHashes: knowledge.sourceHashes, sources, fallbacks, omitted,
    closedInformation: closed, conditionInformationComplete: conditionsKnown, faintedDetailsPruned: canPruneFainted,
    moveCompleteness: pokemon.map(p => ({ id: p.id, complete: completeMoves(p) })).sort((a, b) => String(a.id).localeCompare(String(b.id))),
    candidateCount: blocks.length, mandatoryIds: [],
    selectionPolicy: 'Candidates are conditional facts, not battle recommendations. Unknown observations remain unknown; unselected knowledge does not establish absence. Dependencies must be retained whole or the selection rejected.',
  } };
}
