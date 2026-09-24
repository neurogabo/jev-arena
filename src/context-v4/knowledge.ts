import type { DecisionInput } from '../showdown/types.js';
import type { ConciseKnowledge } from '../knowledge/concise.js';
import { prepareSelectiveKnowledge } from '../knowledge/selective.js';
import { reviewedRules } from '../knowledge/rules.js';
import { digest } from '../wiki.js';

export type FocusedRule = { id: string; text: string; sourceIds: string[]; dependencies: string[] };
export type IntrinsicMove = {
  name: string; priority: number; type: string; category: string; basePower: number;
  accuracy: number | true; target: string; description: string;
  flags?: string[]; mechanics?: Record<string, unknown>; limitations?: string[];
};
export type IntrinsicEffect = { name: string; description: string; mechanics?: Record<string, unknown>; limitations?: string[] };
export type FocusedMoveFacts = { moves: IntrinsicMove[]; abilities: IntrinsicEffect[]; items: IntrinsicEffect[] };
const record = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
const unique = (values: string[]) => [...new Set(values)].sort();

// Keep mechanically conditional clauses in the same unit. Each list is a
// partition of the reviewed text, not a lossy rewrite or a battle heuristic.
const partitions: Record<string, { suffix: string; begins: string }[]> = {
  'action-order': [{ suffix: 'switch-and-mega', begins: 'Ordinary voluntary switches' }, { suffix: 'priority-and-speed', begins: 'Higher move priority' }],
  execution: [{ suffix: 'pp', begins: 'An action can be interrupted' }, { suffix: 'success', begins: 'Reachability, protection' }, { suffix: 'flags-and-accuracy', begins: 'The protect flag' }],
  'type-and-status-immunities': [{ suffix: 'types', begins: 'The ordinary type factors' }, { suffix: 'status', begins: 'Fire blocks new burn' }, { suffix: 'grounding', begins: 'Grounding can change' }],
  statistics: [{ suffix: 'trained-stats-and-stages', begins: 'Use supplied actual trained statistics' }, { suffix: 'accuracy', begins: 'Accuracy/evasion instead' }],
  damage: [{ suffix: 'ordinary', begins: 'Ordinary damage depends' }, { suffix: 'critical-hits', begins: 'Normal crit chances' }, { suffix: 'triggers-and-multiple-hits', begins: 'Contact, damage, stat loss' }],
  'fainting-and-residuals': [{ suffix: 'fainting', begins: 'Fainted Pokemon cannot' }, { suffix: 'residual-order', begins: 'End-of-turn effects' }],
  'ability-and-item-state': [{ suffix: 'effective-state', begins: 'Apply the holder' }, { suffix: 'item-events', begins: 'Automatic item use' }],
  weather: [{ suffix: 'replacement-and-duration', begins: 'Only one ordinary weather' }, { suffix: 'attacks-and-charge', begins: 'Rain multiplies Water' }, { suffix: 'speed-and-suppression', begins: 'Matching active weather-Speed' }],
  'choice-and-first-action': [{ suffix: 'choice-lock', begins: 'Effective Choice Scarf' }, { suffix: 'charge-and-recharge', begins: 'Multi-turn charging' }, { suffix: 'entry-eligibility', begins: 'Fake Out and First Impression' }, { suffix: 'struggle', begins: 'Forced Struggle' }],
};

function partition(id: string, text: string): { id: string; text: string }[] {
  const spec = partitions[id];
  if (!spec) return [{ id: `rule:${id}`, text }];
  const offsets = spec.map(part => {
    const offset = text.indexOf(part.begins);
    if (offset < 0 || text.indexOf(part.begins, offset + 1) >= 0) throw new Error(`Reviewed focused-rule boundary changed: ${id}/${part.suffix}.`);
    return offset;
  });
  if (offsets[0] !== 0 || offsets.some((offset, i) => i > 0 && offset <= offsets[i - 1]!)) throw new Error(`Invalid focused-rule partition: ${id}.`);
  const parts = spec.map((part, i) => ({ id: `rule:${id}:${part.suffix}`, text: text.slice(offsets[i], offsets[i + 1] ?? text.length).trim() }));
  if (parts.map(part => part.text).join(' ') !== text) throw new Error(`Focused partition lost reviewed source text: ${id}.`);
  return parts;
}

function extraMechanics(facts: Record<string, unknown>, skipped: Set<string>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(facts).filter(([key, value]) => !skipped.has(key) && value !== false && value !== undefined &&
    !(key === 'critRatio' && value === 1) && !(typeof value === 'object' && value !== null && !Object.keys(value).length)));
}
const commonSkip = new Set(['name', 'description', 'sourceLimitations', 'basePp', 'maximumPpInChampions', 'noPPBoosts']);

function mechanicsText(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(mechanicsText).join('; ')}]`;
  if (value !== null && typeof value === 'object') return `{ ${Object.entries(value).map(([key, entry]) => `${key}: ${mechanicsText(entry)}`).join(', ')} }`;
  return String(value);
}
function suffixText(facts: { mechanics?: Record<string, unknown>; limitations?: string[] }): string {
  return `${facts.mechanics ? ` Additional mechanical fields: ${mechanicsText(facts.mechanics)}.` : ''}${facts.limitations ? ` Source limitations: ${facts.limitations.join(' ')}` : ''}`;
}

/** Mandatory intrinsic definitions; optional source-backed relational mechanics.
 * This compiler never scores, recommends, simulates, or invents an action.
 */
export function prepareFocusedKnowledge(input: DecisionInput, knowledge: ConciseKnowledge): {
  moveFacts: FocusedMoveFacts; moveText: string; rules: FocusedRule[]; audit: Record<string, unknown>;
} {
  const prepared = prepareSelectiveKnowledge(input, knowledge);
  const moveFacts: FocusedMoveFacts = { moves: [], abilities: [], items: [] };
  const intrinsicSources: string[] = [];
  for (const block of prepared.blocks.filter(block => /^entity:(move|ability|item):/.test(block.id))) {
    const facts = record(block.facts);
    intrinsicSources.push(...block.sourceIds);
    const limitations = strings(facts.sourceLimitations);
    if (block.id.startsWith('entity:move:')) {
      for (const key of ['name', 'type', 'category', 'target', 'description']) if (typeof facts[key] !== 'string') throw new Error(`Missing intrinsic ${key}: ${block.id}.`);
      if (typeof facts.priority !== 'number' || typeof facts.basePower !== 'number' || !(typeof facts.accuracy === 'number' || facts.accuracy === true)) throw new Error(`Missing numeric move definition: ${block.id}.`);
      const skip = new Set([...commonSkip, 'priority', 'type', 'category', 'basePower', 'accuracy', 'target', 'flags']);
      const mechanics = extraMechanics(facts, skip);
      const flags = Object.entries(record(facts.flags)).filter(([, value]) => Boolean(value)).map(([key]) => key).sort();
      moveFacts.moves.push({ name: String(facts.name), priority: facts.priority, type: String(facts.type), category: String(facts.category),
        basePower: facts.basePower, accuracy: facts.accuracy, target: String(facts.target), description: String(facts.description),
        ...(flags.length ? { flags } : {}), ...(Object.keys(mechanics).length ? { mechanics } : {}), ...(limitations.length ? { limitations } : {}) });
    } else {
      if (typeof facts.name !== 'string' || typeof facts.description !== 'string') throw new Error(`Missing intrinsic effect description: ${block.id}.`);
      const mechanics = extraMechanics(facts, commonSkip);
      const entry = { name: facts.name, description: facts.description, ...(Object.keys(mechanics).length ? { mechanics } : {}), ...(limitations.length ? { limitations } : {}) };
      moveFacts[block.id.startsWith('entity:ability:') ? 'abilities' : 'items'].push(entry);
    }
  }
  const moveText = [
    ...(moveFacts.moves.length ? ['Known moves:', ...moveFacts.moves.map(move =>
      `${move.name}: priority ${move.priority > 0 ? '+' : ''}${move.priority}; ${move.type}, ${move.category}; base power ${move.basePower}; accuracy ${move.accuracy === true ? 'no ordinary accuracy check' : `${move.accuracy}%`}; target ${move.target}. ${move.description}${move.flags?.length ? ` Flags: ${move.flags.join(', ')}.` : ''}${suffixText(move)}`)] : []),
    ...(moveFacts.abilities.length ? ['Known abilities (conditional definitions):', ...moveFacts.abilities.map(effect => `${effect.name}: ${effect.description}${suffixText(effect)}`)] : []),
    ...(moveFacts.items.length ? ['Known held items (conditional definitions):', ...moveFacts.items.map(effect => `${effect.name}: ${effect.description}${suffixText(effect)}`)] : []),
  ].join('\n');

  // A broad v3 observer requirement such as M16 on any weather event is not
  // evidence of terrain. Reachability follows actual current effects/definitions.
  const fieldText = JSON.stringify({ field: input.state.field, sideConditions: input.state.sideConditions,
    pokemonEffects: Array.isArray(input.state.pokemon) ? input.state.pokemon.map(p => record(p).effects) : null }).toLowerCase();
  const definitions = [...moveFacts.moves, ...moveFacts.abilities, ...moveFacts.items].map(entry => `${entry.name} ${entry.description}`).join('\n');
  const terrainKnown = /terrain|\b(?:electric|psychic|misty|grassy) surge\b|surge surfer/i.test(`${fieldText}\n${definitions}`);
  const uncertain = prepared.audit.closedInformation !== true || prepared.audit.conditionInformationComplete !== true;
  const terrainReachable = terrainKnown || uncertain;
  const roomNames = ['gravity', 'trickroom', 'wonderroom', 'magicroom'];
  const canonicalFields = fieldText.replace(/[^a-z0-9]/g, '');
  const knownMoves = new Set(moveFacts.moves.map(move => move.name.toLowerCase().replace(/[^a-z0-9]/g, '')));
  const roomKnown = roomNames.some(name => knownMoves.has(name) || canonicalFields.includes(name));
  const roomReachable = roomKnown || uncertain;
  const ruleMap = new Map(reviewedRules.map(rule => [rule.id, rule]));
  const rules: FocusedRule[] = [];
  const ruleAudit: Record<string, unknown>[] = [];
  for (const block of prepared.blocks.filter(block => block.id.startsWith('rule:') || block.id.startsWith('source:'))) {
    if (block.id === 'source:M16' && !terrainReachable) continue;
    if (block.id === 'source:M21' && !roomReachable) continue;
    const reviewed = ruleMap.get(block.id.slice('rule:'.length));
    // The v3 order bundle repeats intrinsic priorities and ability definitions.
    // They are mandatory above; relational rules use the reviewed original only.
    const parts = reviewed ? partition(reviewed.id, reviewed.text) : [{ id: block.id, text: block.text }];
    for (const part of parts) {
      const sourceIds = reviewed ? [...reviewed.sources] : [...block.sourceIds];
      rules.push({ ...part, sourceIds, dependencies: [] });
      ruleAudit.push({ id: part.id, parentId: block.id, trigger: block.trigger, textHash: digest(part.text), sourceIds });
    }
  }
  const byId = new Map(rules.map(rule => [rule.id, rule]));
  const depend = (id: string, ...dependencyIds: string[]) => {
    const rule = byId.get(id); if (!rule) return;
    for (const dependencyId of dependencyIds) {
      if (!byId.has(dependencyId)) throw new Error(`Focused rule ${id} lacks required dependency ${dependencyId}.`);
      if (!rule.dependencies.includes(dependencyId)) rule.dependencies.push(dependencyId);
    }
  };
  // Preserve the semantic couplings at their narrower scope. Type status
  // immunity, for example, does not require all grounding and damage clauses.
  for (const status of ['burn', 'poison', 'paralysis', 'sleep', 'freeze']) depend(`rule:${status}`, 'rule:type-and-status-immunities:status');
  depend('rule:dire-claw-statuses', 'rule:poison', 'rule:paralysis', 'rule:sleep', 'rule:type-and-status-immunities:status');
  for (const guard of ['personal-protection', 'side-guards']) depend(`rule:${guard}`, 'rule:action-order:priority-and-speed', 'rule:targets');
  depend('rule:spread', 'rule:targets');
  if (byId.has('rule:side-guards')) depend('rule:spread', 'rule:side-guards');
  if (byId.has('source:M16')) {
    depend('source:M16', 'rule:type-and-status-immunities:grounding');
    depend('rule:action-order:priority-and-speed', 'source:M16');
  }
  if (byId.has('source:M21')) depend('rule:action-order:priority-and-speed', 'source:M21');
  depend('rule:mega', 'rule:action-order:switch-and-mega');
  // Exact source fallbacks remain whole. Their candidate presence/absence and
  // byte sizes are explicit in the audit; there is no silent text truncation.
  for (const rule of rules) rule.dependencies.sort();
  const sourceIds = unique([...intrinsicSources, ...rules.flatMap(rule => rule.sourceIds)]);
  const sources = Object.fromEntries(sourceIds.map(id => {
    const source = knowledge.sources[id]; if (!source) throw new Error(`Missing focused provenance: ${id}`);
    return [id, source];
  }));
  return { moveFacts, moveText, rules: rules.sort((a, b) => a.id.localeCompare(b.id)), audit: {
    version: 'focused-v4', formatId: knowledge.wiki.manifest.formatId, engineRevision: knowledge.wiki.manifest.showdownCommit,
    sourceHashes: knowledge.sourceHashes, sources, intrinsicSourceIds: unique(intrinsicSources), intrinsicHash: digest(JSON.stringify(moveFacts)),
    moveTextHash: digest(moveText), rules: ruleAudit, parentReachability: prepared.audit,
    terrain: { reachable: terrainReachable, observedOrReachable: terrainKnown, uncertain,
      rejectedBroadRequirement: !terrainReachable && prepared.blocks.some(block => block.id === 'source:M16') },
    rooms: { reachable: roomReachable, observedOrReachable: roomKnown, uncertain,
      rejectedBroadRequirement: !roomReachable && prepared.blocks.some(block => block.id === 'source:M21') },
    intrinsicPolicy: 'All known remaining move, ability and held-item definitions are supplied independent of Noul relevance. Only proven unreachable fainted details are removed. Descriptions are copied from locked sources, never generated.',
    rulePolicy: 'Reviewed paragraphs are partitioned at fixed checked boundaries without dropping sentences or exceptions. Full source fallbacks stay whole. No action evaluation occurs here.',
  } };
}
