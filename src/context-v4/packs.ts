import type { DecisionInput } from '../showdown/types.js';
import type { ConciseKnowledge } from '../knowledge/concise.js';
import { prepareFocusedKnowledge, type IntrinsicMove, type IntrinsicEffect } from './knowledge.js';
import { digest } from '../wiki.js';

export type FocusPack = { id: string; description: string; text: string; sourceIds: string[] };
type PackDefinition = ((IntrinsicMove & { kind: 'move' }) | (IntrinsicEffect & { kind: 'ability' | 'item' })) & { sourceId: string };
const record = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
const canonical = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
const unique = (values: Iterable<string>) => [...new Set(values)].sort();
const changesStats = (value: unknown): boolean => {
  if (Array.isArray(value)) return value.some(changesStats);
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(([key, child]) => key === 'boosts' && Object.keys(record(child)).some(stat => ['atk', 'def', 'spa', 'spd', 'spe', 'accuracy', 'evasion'].includes(stat)) || changesStats(child));
};

/** Remove authoring headings/dependency labels, retaining every reference paragraph. */
function referenceText(text: string): string {
  const reference = text.includes('## Reference text') ? text.split('## Reference text')[1]!.trim() : text;
  return reference.split('\n').filter(line => !/^Dependencies:|^Include .*Dependencies:/.test(line.trim())).join('\n').trim();
}
const definitionsText = (move: IntrinsicMove) => `${move.name}: ${move.type}, ${move.category}, base power ${move.basePower}, accuracy ${move.accuracy === true ? 'no ordinary accuracy check' : `${move.accuracy}%`}, target ${move.target}. ${move.description}`;

/** Finite alternative context focuses, never battle recommendations or scores. */
export function prepareFocusPacks(input: DecisionInput, knowledge: ConciseKnowledge): { packs: FocusPack[]; audit: Record<string, unknown> } {
  const focused = prepareFocusedKnowledge(input, knowledge);
  const pokemon = (input.state.pokemon as unknown[]).map(record);
  const living = pokemon.filter(p => p.fainted !== true);
  const livingMoveIds = new Set(living.flatMap(p => strings(p.knownMoveIds)));
  const allKnownIds = new Set(pokemon.flatMap(p => strings(p.knownMoveIds)));
  for (const id of input.requiredCardIds) if (id.startsWith('move:') && !allKnownIds.has(id)) livingMoveIds.add(id);
  const liveNames = new Set([...livingMoveIds].map(id => knowledge.entities[id]?.name).filter(Boolean));
  const moves = focused.moveFacts.moves.filter(move => liveNames.has(move.name));
  const knownIds = strings(focused.audit.intrinsicSourceIds);
  const sourceFor = (name: string, kind: string) => {
    const id = knownIds.find(id => id.startsWith(`${kind}:`) && knowledge.entities[id]?.name === name);
    if (!id) throw new Error(`Focus pack lacks intrinsic provenance for ${kind} ${name}.`);
    return id;
  };
  const livingEffectIds = new Set(living.flatMap(p => [p.abilityId, record(p.availableMegaForm).abilityId,
    record(p.item).status === 'known' ? record(p.item).cardId : null]).filter((id): id is string => typeof id === 'string'));
  const namedDefinitions: PackDefinition[] = [
    ...moves.map(move => ({ ...move, sourceId: sourceFor(move.name, 'move'), kind: 'move' as const })),
    ...focused.moveFacts.abilities.map(effect => ({ ...effect, sourceId: sourceFor(effect.name, 'ability'), kind: 'ability' as const })).filter(effect => livingEffectIds.has(effect.sourceId)),
    ...focused.moveFacts.items.map(effect => ({ ...effect, sourceId: sourceFor(effect.name, 'item'), kind: 'item' as const })).filter(effect => livingEffectIds.has(effect.sourceId)),
  ];
  const rules = new Map(focused.rules.map(rule => [rule.id, rule]));
  const parentAudit = record(focused.audit.parentReachability);
  const uncertain = parentAudit.closedInformation !== true || parentAudit.conditionInformationComplete !== true;
  const effects = JSON.stringify({ field: input.state.field, sideConditions: input.state.sideConditions,
    pokemon: pokemon.map(p => ({ status: p.status, effects: p.effects })) }).toLowerCase();
  const canonicalEffects = canonical(effects);
  const moveWords = moves.map(move => `${move.name} ${move.description}`).join('\n');
  const allWords = namedDefinitions.map(entry => `${entry.name} ${entry.description}`).join('\n');
  const automaticItems = namedDefinitions.filter(entry => entry.kind === 'item' && /\b(?:restor\w*|recover\w*|heal\w*|consum\w*|HP|health)\b/i.test(entry.description));
  const terrainText = `${canonicalEffects}\n${canonical(allWords)}`;
  const activeTerrainSources = ([['electricterrain', 'M17'], ['grassyterrain', 'M18'], ['mistyterrain', 'M19'], ['psychicterrain', 'M20']] as const)
    .filter(([name]) => terrainText.includes(name)).map(([, id]) => id);
  const packs: FocusPack[] = [];
  const packAudit: Record<string, unknown>[] = [];

  const build = (id: string, description: string, assemble: (builder: {
    text: (text: string, sources: string[]) => void;
    rule: (id: string) => void;
    source: (id: string) => void;
    definition: (entry: typeof namedDefinitions[number], fullMove?: boolean) => void;
  }) => void) => {
    const lines: string[] = [];
    const sourceIds = new Set<string>();
    const expandedRules = new Set<string>();
    const text = (value: string, sources: string[]) => {
      if (!lines.includes(value)) lines.push(value);
      sources.forEach(source => sourceIds.add(source));
    };
    const source = (sourceId: string) => {
      const card = knowledge.wiki.cards[sourceId]; if (!card) throw new Error(`Missing focus source ${sourceId}.`);
      text(referenceText(card.text), [sourceId]);
    };
    const rule = (ruleId: string) => {
      if (expandedRules.has(ruleId)) return;
      const candidate = rules.get(ruleId); if (!candidate) return;
      expandedRules.add(ruleId);
      text(ruleId.startsWith('source:') ? referenceText(candidate.text) : candidate.text, candidate.sourceIds);
      for (const dependency of candidate.dependencies) {
        if (!rules.has(dependency)) throw new Error(`Missing focus dependency ${dependency}.`);
        rule(dependency);
      }
    };
    const definition = (entry: typeof namedDefinitions[number], fullMove = false) => {
      text(fullMove && entry.kind === 'move' ? definitionsText(entry) : `${entry.name}: ${entry.description}`, [entry.sourceId]);
      const limitations = strings(entry.limitations);
      if (limitations.length) text(`${entry.name} source limitations: ${limitations.join(' ')}`, [entry.sourceId]);
    };
    assemble({ text, rule, source, definition });
    if (!lines.length) return;
    if (uncertain) text('Unrevealed moves, abilities, items and effect durations remain unknown. These conditional definitions do not establish an opposing command or the absence of an unobserved blocker.', []);
    const pack = { id, description, text: lines.join('\n'), sourceIds: unique(sourceIds) };
    packs.push(pack);
    const bytes = Buffer.byteLength(pack.text);
    const targetBytes = id === 'order' ? 800 : 2000;
    packAudit.push({ id, textHash: digest(pack.text), bytes, targetBytes, exceedsSizeTarget: bytes > targetBytes,
      includedRuleIds: [...expandedRules], sourceIds: pack.sourceIds,
      sizePolicy: 'Size targets are diagnostic. Applicable exception dependencies are preserved whole; no candidate is truncated.' });
  };

  if (moves.length) build('order', 'Base priority, Speed, and known effects that change or prevent action order.', b => {
    const grouped = new Map<number, string[]>();
    for (const move of moves) grouped.set(move.priority, [...(grouped.get(move.priority) ?? []), move.name]);
    b.text([...grouped].sort(([a], [z]) => z - a).map(([priority, names]) => `Base priority ${priority > 0 ? '+' : ''}${priority}: ${names.sort().join(', ')}.`).join(' '), moves.map(move => sourceFor(move.name, 'move')));
    b.rule('rule:action-order:priority-and-speed');
    // Definitions retain conditions, including Dark immunity, suppression,
    // remaining actions, entry requirements, and whether Speed differs from priority.
    const orderingMoves = new Set(['afteryou', 'quash', 'instruct', 'encore', 'suckerpunch', 'upperhand', 'focuspunch', 'beakblast', 'shelltrap']);
    for (const entry of namedDefinitions) if (/priority|\bspeed\b|moves? (?:first|last)|move order/i.test(entry.description) ||
      orderingMoves.has(canonical(entry.name)) || (entry.kind === 'move' && /"spe"\s*:/.test(JSON.stringify(record(entry).mechanics)))) b.definition(entry);
    if (living.some(p => p.status === 'par')) b.rule('rule:paralysis');
    if (rules.has('rule:tailwind')) b.rule('rule:tailwind');
    if (namedDefinitions.some(entry => ['quickguard', 'wideguard'].includes(canonical(entry.name)))) b.rule('rule:side-guards');
    if (namedDefinitions.some(entry => /^(protect|detect|spikyshield|kingsshield|banefulbunker|silktrap|burningbulwark|endure)$/.test(canonical(entry.name)))) b.rule('rule:personal-protection');
    for (const id of activeTerrainSources.filter(id => id === 'M20' || id === 'M18')) { b.source(id); b.rule('source:M16'); b.rule('rule:type-and-status-immunities:grounding'); }
    if (activeTerrainSources.some(id => id === 'M20' || id === 'M18')) for (const entry of namedDefinitions) {
      if (/grounded|ungrounded|airborne|ground-type|gravity|levitat/i.test(entry.description)) b.definition(entry);
    }
    if (canonicalEffects.includes('encore')) b.source('M22');
  });

  const directed = moves.some(move => !['self', 'allySide', 'all'].includes(move.target));
  if (directed || /protect|guard|redirection|substitute/.test(effects)) build('protection-targets', 'Who an action can affect, retargeting, redirection, spread, and protection.', b => {
    b.rule('rule:targets');
    if (moves.some(move => ['allAdjacent', 'allAdjacentFoes'].includes(move.target))) b.rule('rule:spread');
    if (rules.has('rule:personal-protection')) b.rule('rule:personal-protection');
    if (rules.has('rule:side-guards')) b.rule('rule:side-guards');
    for (const entry of namedDefinitions) if (/protect|redirect|powder|substitute|target.*(?:instead|ally)|draws? (?:in|to)|priority.*prevent|prevent.*priority/i.test(entry.description)) b.definition(entry);
    if (/powder|prankster/i.test(allWords)) b.rule('rule:type-and-status-immunities:status');
    for (const id of activeTerrainSources.filter(id => id === 'M20')) { b.source(id); b.rule('source:M16'); b.rule('rule:type-and-status-immunities:grounding'); }
  });

  const damaging = moves.filter(move => move.category !== 'Status');
  const damageModifiers = moves.filter(move => move.category === 'Status' && (changesStats(move.mechanics) || /\b(?:Attack|Defense|damage|power|accuracy|evasion|critical|stages?|screens?)\b/i.test(move.description)));
  if (damaging.length || damageModifiers.length || rules.has('rule:screens')) build('damage-type-accuracy', 'Intrinsic damage properties, accuracy, and current known damage or immunity effects.', b => {
    for (const move of damaging) b.definition(namedDefinitions.find(entry => entry.kind === 'move' && entry.name === move.name)!, true);
    for (const move of damageModifiers) b.definition(namedDefinitions.find(entry => entry.kind === 'move' && entry.name === move.name)!, true);
    b.rule('rule:damage:ordinary'); b.rule('rule:type-and-status-immunities:types');
    b.rule('rule:execution:flags-and-accuracy');
    b.rule('rule:screens');
    if (damageModifiers.some(move => changesStats(move.mechanics))) b.rule('rule:statistics:trained-stats-and-stages');
    for (const entry of namedDefinitions.filter(entry => entry.kind !== 'move')) if (/attack|defen|power|damage|immune|critical|accuracy|evasion|hit|contact|offensive|special/i.test(entry.description)) b.definition(entry);
    if (/held item|holding|consum/i.test(moveWords)) for (const entry of automaticItems) b.definition(entry);
    if (/critical/i.test(allWords)) b.rule('rule:damage:critical-hits');
    if (/hits? (?:two|twice|three|2|3|five)|multiple hits|each hit|focus sash|substitute/i.test(allWords)) b.rule('rule:damage:triggers-and-multiple-hits');
    if (/gravity|magnetrise|telekinesis|smackdown|ingrain/.test(canonicalEffects) || namedDefinitions.some(entry => /^(airballoon|ironball|levitate)$/.test(canonical(entry.name)))) b.rule('rule:type-and-status-immunities:grounding');
  });

  const statusPatterns = [
    ['burn', /\bbrn\b|\bburn(?:ed|s)?\b/i], ['poison', /\bpsn\b|\btox\b|poison/i], ['paralysis', /\bpar\b|paraly/i],
    ['sleep', /\bslp\b|sleep|asleep|yawn/i], ['freeze', /\bfrz\b|freez|frozen/i], ['confusion-and-flinch', /confus|flinch/i],
  ] as const;
  const statusWords = `${effects}\n${moveWords}\n${namedDefinitions.filter(entry => entry.kind !== 'move' && /chance|inflicts|causes|becomes|receives|falls/i.test(entry.description)).map(entry => entry.description).join('\n')}`;
  const relevantStatuses = statusPatterns.filter(([, pattern]) => pattern.test(statusWords));
  const residual = /leechseed|perishsong|wish|aquaring|ingrain|saltcure|sandstorm|yawn|curse|binding/.test(canonicalEffects) || /recover|end of (?:each|the) turn|residual|poison|burn/i.test(allWords);
  if (relevantStatuses.length || residual || automaticItems.length || uncertain) build('status-residual', 'Status effects, fainting, and end-of-turn consequences.', b => {
    b.rule('rule:fainting-and-residuals:fainting');
    for (const [id] of relevantStatuses) b.rule(`rule:${id}`);
    if (residual || relevantStatuses.some(([id]) => ['burn', 'poison'].includes(id))) b.rule('rule:fainting-and-residuals:residual-order');
    for (const entry of namedDefinitions) if (/burn|poison|paraly|sleep|asleep|freeze|frozen|confus|flinch|restor|recover|heal|end of (?:each|the) turn|perish|leech seed/i.test(entry.description)) b.definition(entry);
    if (automaticItems.length) {
      for (const entry of automaticItems) b.definition(entry);
      b.rule('rule:ability-and-item-state:effective-state'); b.rule('rule:ability-and-item-state:item-events');
    }
    if (moves.some(move => canonical(move.name) === 'direclaw')) b.rule('rule:dire-claw-statuses');
    if (rules.has('source:M24') && /heal|recover|wish|roost|safeguard/i.test(`${effects}\n${moveWords}`)) b.rule('source:M24');
  });

  const fieldRelated = /weather|rain|sun|snow|sandstorm|terrain|gravity|trick room|wonder room|magic room|tailwind|mega/i;
  if (Array.isArray(input.state.field) && input.state.field.length || living.some(p => p.availableMegaForm || p.megaEvolved) ||
    fieldRelated.test(allWords) || /tailwind/.test(effects) || uncertain) build('field-weather-mega', 'Weather, terrain, rooms, and available Mega changes before or between actions.', b => {
    b.rule('rule:action-order:switch-and-mega');
    for (const id of ['rule:weather:replacement-and-duration', 'rule:weather:attacks-and-charge', 'rule:weather:speed-and-suppression', 'rule:sand-and-snow', 'rule:tailwind', 'rule:mega', 'source:M21']) b.rule(id);
    for (const id of activeTerrainSources) { b.source(id); b.rule('source:M16'); b.rule('rule:type-and-status-immunities:grounding'); }
    for (const entry of namedDefinitions) if (fieldRelated.test(`${entry.name} ${entry.description}`) || /utility umbrella|air balloon|iron ball/i.test(entry.name)) b.definition(entry);
  });

  const ourSide = record(input.state.request).ourSide;
  const reserves = living.some(p => p.side === ourSide && p.slot === null);
  const resourceMove = /switch|held item|holding|consum|(?:first|following) turn|\bPP\b|recharg/i.test(moveWords);
  const resourceObserved = living.some(p => p.lastItemLoss || Object.values(record(p.movePP)).some(pp => record(pp).current === 0));
  if (reserves || input.phase !== 'move' || resourceMove || resourceObserved || automaticItems.length || /recharge|choicelock|disable|encore|taunt/.test(canonicalEffects)) build('switching-resources', 'Switches, entry effects, consumed items, PP, and action restrictions.', b => {
    if (reserves || input.phase !== 'move' || /switch/i.test(moveWords)) b.rule('rule:switches');
    for (const id of ['rule:ability-and-item-state:effective-state', 'rule:ability-and-item-state:item-events', 'rule:choice-and-first-action:choice-lock',
      'rule:choice-and-first-action:charge-and-recharge', 'rule:choice-and-first-action:entry-eligibility', 'rule:choice-and-first-action:struggle']) b.rule(id);
    for (const entry of namedDefinitions) if (/switch|held item|holding|restor|recover|heal|consum|(?:first|following) turn|\bPP\b|recharg|locks?|disable|encore|taunt/i.test(entry.description)) b.definition(entry);
    for (const entry of automaticItems) b.definition(entry);
    if (rules.has('source:M22')) b.rule('source:M22');
  });

  const usedSources = unique(packs.flatMap(pack => pack.sourceIds));
  const sources = Object.fromEntries(usedSources.map(id => {
    const source = knowledge.sources[id]; if (!source) throw new Error(`Missing focus pack audit source ${id}.`);
    return [id, source];
  }));
  return { packs, audit: { version: 'focused-v4-finite-packs', sourceHashes: knowledge.sourceHashes,
    engineRevision: knowledge.wiki.manifest.showdownCommit, formatId: knowledge.wiki.manifest.formatId,
    packs: packAudit, sources, uncertain, intrinsicPolicy: 'Each pack selects definitions by mechanical focus; no intrinsic blanket is forced into every context.',
    orderPolicy: 'All known living move base priorities are grouped. These are not actual effective order, future commands, or action recommendations.',
    unknownPolicy: 'Unknown is not absent. Reachable dependency rules and known blockers remain; hidden sets are not guessed.',
  } };
}
