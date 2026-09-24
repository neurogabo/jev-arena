import type { DecisionInput } from '../showdown/types.js';
import type { ConciseKnowledge } from '../knowledge/concise.js';
import { prepareFocusedKnowledge, type IntrinsicMove } from '../context-v4/knowledge.js';
import { reviewedRules } from '../knowledge/rules.js';
import { digest } from '../wiki.js';
import { projectObservation } from '../showdown/concise-observation.js';

export type MechanicalSection = { id: string; text: string; sourceIds: string[] };
const record = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
const canonical = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
const unique = (values: Iterable<string>) => [...new Set(values)].sort();
const ruleMap = new Map(reviewedRules.map(rule => [rule.id, rule]));

function ruleText(id: string): string {
  const rule = ruleMap.get(id); if (!rule) throw new Error(`Unreviewed mechanical relation: ${id}.`); return rule.text;
}
function sentence(id: string, begins: string): string {
  const text = ruleText(id);
  const start = text.indexOf(begins);
  if (start < 0 || text.indexOf(begins, start + 1) >= 0) throw new Error(`Mechanical relation sentence changed: ${id}/${begins}.`);
  const remainder = text.slice(start);
  // Decimal periods are not sentence boundaries. The reviewed unit ends before
  // a capitalized next sentence or at the end of the paragraph.
  return remainder.split(/(?<=[.!?])\s+(?=[A-Z])/)[0]!;
}
function referenceParagraphs(knowledge: ConciseKnowledge, id: string): string[] {
  const text = knowledge.wiki.cards[id]?.text;
  if (!text) throw new Error(`Missing mechanical relation source: ${id}.`);
  return (text.split('## Reference text')[1] ?? text).trim().split(/\n\s*\n/)
    .filter(part => !/^Dependencies:|^Include .*Dependencies:/.test(part.trim()));
}

/** Bind a bounded set of mechanical relationships to current public entities.
 * No scenario catalogue, answer key, simulator, move score or future choice is read.
 */
export function prepareMechanicalRelations(input: DecisionInput, knowledge: ConciseKnowledge): {
  text: string; sections: MechanicalSection[]; audit: Record<string, unknown>;
} {
  const focused = prepareFocusedKnowledge(input, knowledge);
  const allPokemon = (input.state.pokemon as unknown[]).map(record);
  const living = allPokemon.filter(p => p.fainted !== true);
  const ourSide = record(input.state.request).ourSide;
  if (ourSide !== 'p1' && ourSide !== 'p2') throw new Error('Mechanical relationships require a known controlled side.');
  const projected = projectObservation(input);
  const projectedById = new Map((projected.battle.participants as unknown[]).map(value => {
    const pokemon = record(value); return [pokemon.id, pokemon];
  }));
  const label = (p: Record<string, unknown>) => `${p.side === ourSide ? 'our' : 'opposing'} ${knowledge.entities[String(p.speciesId)]?.name ?? String(p.speciesId)}`;
  const intrinsic = new Map(focused.moveFacts.moves.map(move => [move.name, move]));
  const owners = living.map(p => ({ pokemon: p, name: label(p), moves: strings(p.knownMoveIds).filter(id => id !== 'move:recharge').map(id => {
    const entity = knowledge.entities[id]; if (!entity) throw new Error(`Missing known move relation source: ${id}.`);
    const move = intrinsic.get(entity.name); if (!move) throw new Error(`Missing intrinsic move relation: ${id}.`);
    return { id, move };
  }) }));
  const uniqueMoves = new Map(owners.flatMap(owner => owner.moves).map(entry => [entry.id, entry.move]));
  // A current special request move can be absent from every declared set.
  for (const id of input.requiredCardIds.filter(id => id === 'move:struggle')) {
    const entity = knowledge.entities[id]; const move = entity && intrinsic.get(entity.name);
    if (move) uniqueMoves.set(id, move);
  }
  const effects = JSON.stringify({ field: input.state.field, sides: input.state.sideConditions,
    pokemon: living.map(p => ({ status: p.status, effects: p.effects })) });
  const effectIds = canonical(effects);
  const uncertain = record(focused.audit.parentReachability).closedInformation !== true || record(focused.audit.parentReachability).conditionInformationComplete !== true;
  const sections: MechanicalSection[] = [];
  const add = (id: string, lines: string[], sourceIds: string[]) => {
    const nonempty = [...new Set(lines.filter(Boolean))];
    if (nonempty.length) sections.push({ id, text: nonempty.join('\n'), sourceIds: unique(sourceIds) });
  };
  const definition = (id: string): string => {
    const entity = knowledge.entities[id]; if (!entity) throw new Error(`Missing known relation definition: ${id}.`);
    return entity.description ?? '';
  };
  const declaredAbilities = owners.flatMap(owner => {
    const abilities: { owner: string; id: string; potential: boolean }[] = [];
    if (typeof owner.pokemon.abilityId === 'string') abilities.push({ owner: owner.name, id: owner.pokemon.abilityId, potential: false });
    const mega = record(owner.pokemon.availableMegaForm);
    if (typeof mega.abilityId === 'string') abilities.push({ owner: `${owner.name} after its available Mega`, id: mega.abilityId, potential: true });
    return abilities;
  });
  const heldItems = owners.flatMap(owner => {
    const item = record(owner.pokemon.item);
    return item.status === 'known' && typeof item.cardId === 'string' ? [{ owner: owner.name, pokemon: owner.pokemon, id: item.cardId }] : [];
  });

  if (uniqueMoves.size) {
    const order = owners.filter(owner => owner.moves.length).map(owner => `${owner.name}: ${owner.moves.map(({ move }) => `${move.name} ${move.priority > 0 ? '+' : ''}${move.priority}`).join(', ')}.`);
    const special = [...uniqueMoves].filter(([id]) => !owners.some(owner => owner.moves.some(move => move.id === id)));
    if (special.length) order.push(`Request-only moves: ${special.map(([, move]) => `${move.name} ${move.priority > 0 ? '+' : ''}${move.priority}`).join(', ')}.`);
    order[0] = `Base move priorities — ${order[0]}`;
    const priorityGroups = new Map<number, string[]>();
    for (const move of uniqueMoves.values()) priorityGroups.set(move.priority, [...(priorityGroups.get(move.priority) ?? []), move.name]);
    const grouped = [...priorityGroups].sort(([first], [second]) => second - first);
    const namedList = (names: string[]) => names.length < 2 ? names[0]! : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
    // Adjacent group comparisons express the complete ordering without an
    // action score, a case-specific rule, or a forecast of effective priority.
    for (let i = 0; i + 1 < grouped.length; i++) {
      const higher = grouped[i]![1].sort(); const lower = grouped[i + 1]![1].sort();
      order.push(`${namedList(higher)} ${higher.length === 1 ? 'has' : 'have'} higher base priority than ${namedList(lower)}.`);
    }
    if (grouped.length > 1) order.push('These compare base priorities; effective order still depends on applicable modifiers and blockers.');
    order.push(sentence('action-order', 'Higher move priority'));
    if (effectIds.includes('trickroom') || [...uniqueMoves.keys()].includes('move:trickroom')) order.push(sentence('action-order', 'Trick Room reverses'));
    if (declaredAbilities.some(ability => /priority|\bSpeed\b/i.test(definition(ability.id))) || heldItems.some(item => /priority|\bSpeed\b/i.test(definition(item.id))) ||
      owners.some(owner => owner.pokemon.availableMegaForm) || [...uniqueMoves.values()].some(move => /"spe"\s*:/.test(JSON.stringify(move.mechanics))) || /tailwind/.test(effectIds)) {
      order.push(sentence('action-order', 'Speed changes, including'));
      order.push(sentence('action-order', 'Acting early within a bracket'));
    }
    add('priority', order, ['C03', ...uniqueMoves.keys()]);
  }

  const fieldMove = (move: IntrinsicMove) => /weather|rain|sun|snow|sandstorm|terrain|gravity|trick room|wonder room|magic room|tailwind/i.test(`${move.name} ${move.description}`);
  const boundToItem = (move: IntrinsicMove) => /held item|holding|consum|restore.*item/i.test(move.description);
  const moveLines: string[] = []; const moveSources: string[] = [];
  for (const [id, move] of uniqueMoves) {
    if (fieldMove(move) || boundToItem(move)) continue;
    const ownerNames = owners.filter(owner => owner.moves.some(entry => entry.id === id)).map(owner => owner.name).join(' / ');
    const basics = move.category === 'Status' ? '' : `${move.type} ${move.category.toLowerCase()}, power ${move.basePower}, ${move.accuracy === true ? 'no ordinary accuracy check' : `${move.accuracy}% base accuracy`}. `;
    const description = move.description === 'No additional effect.' || move.description === 'This move does not check accuracy.' ? '' : move.description;
    moveLines.push(`${ownerNames ? `${ownerNames}'s ` : ''}${move.name}: ${basics}${description}`.trim()); moveSources.push(id);
  }
  add('known-moves', moveLines, moveSources);

  const abilityLines: string[] = []; const abilitySources: string[] = [];
  for (const ability of declaredAbilities) {
    const entity = knowledge.entities[ability.id]!;
    abilityLines.push(`${ability.potential ? 'If Mega is declared, ' : ''}${ability.owner} has ${entity.name}: ${definition(ability.id)}`);
    abilitySources.push(ability.id);
    if (ability.id === 'ability:prankster') {
      const owner = owners.find(owner => ability.owner.startsWith(owner.name))!;
      const statusMoves = owner.moves.filter(({ move }) => move.category === 'Status');
      if (statusMoves.length) abilityLines.push(`When effective, ${ability.owner}'s Prankster concerns its known Status moves: ${statusMoves.map(({ move }) => move.name).join(', ')}.`);
      const darkRecipients = owners.filter(candidate => candidate.pokemon.side !== owner.pokemon.side && strings(candidate.pokemon.typeIds).includes('type:dark'));
      if (darkRecipients.length) abilityLines.push(`Known opposing Dark recipients: ${darkRecipients.map(recipient => recipient.name).join(', ')}. ${sentence('type-and-status-immunities', 'Grass blocks powder')}`);
      abilitySources.push('C08', 'C09', 'C16');
    }
  }
  add('abilities', abilityLines, abilitySources);

  const itemLines: string[] = []; const itemSources: string[] = [];
  for (const item of heldItems) {
    const entity = knowledge.entities[item.id]!;
    const related = owners.find(owner => owner.pokemon === item.pokemon)!.moves.filter(entry => boundToItem(entry.move));
    itemLines.push(`${item.owner} holds ${entity.name}: ${definition(item.id)}`); itemSources.push(item.id);
    for (const { id, move } of related) { itemLines.push(`${item.owner}'s ${move.name} refers to that held ${entity.name}: ${move.description}`); itemSources.push(id); }
    if (/restor|recover|heal|consum|\bHP\b/i.test(definition(item.id))) {
      itemLines.push(sentence('ability-and-item-state', 'Automatic item use can happen')); itemSources.push('C19', 'M27');
    }
  }
  for (const owner of owners) for (const { id, move } of owner.moves.filter(entry => boundToItem(entry.move))) {
    if (record(owner.pokemon.item).status === 'known') continue;
    const status = record(owner.pokemon.item).status === 'none' ? 'none' : 'unknown';
    itemLines.push(`${owner.name}'s current held item is ${status}; ${move.name}: ${move.description}`); itemSources.push(id);
  }
  add('held-item-interactions', itemLines, itemSources);

  const statusRules: Record<string, string> = { brn: 'burn', psn: 'poison', tox: 'poison', par: 'paralysis', slp: 'sleep', frz: 'freeze' };
  const statusLines: string[] = []; const statusSources: string[] = [];
  for (const owner of owners) {
    const status = String(owner.pokemon.status ?? '');
    const rule = statusRules[status]; if (!rule) continue;
    statusLines.push(`${owner.name} currently has ${status}: ${ruleText(rule)}`); statusSources.push(...ruleMap.get(rule)!.sources);
  }
  if (owners.some(owner => ['brn', 'psn', 'tox'].includes(String(owner.pokemon.status)))) {
    statusLines.push('Existing poison and burn have end-of-turn residual events, separate from ordinary moves. Poison is processed before burn; established residual damage is not blocked by Protect.');
    statusLines.push(sentence('fainting-and-residuals', 'Fainted Pokemon cannot')); statusSources.push('C20', 'M30', 'M09');
  }
  if (/confusion|flinch/.test(effectIds)) { statusLines.push(ruleText('confusion-and-flinch')); statusSources.push('M06'); }
  add('current-status', statusLines, statusSources);

  const protectionMoves = ['protect', 'detect', 'quickguard', 'wideguard', 'feint', 'spikyshield', 'kingsshield', 'banefulbunker', 'silktrap', 'burningbulwark', 'endure'];
  const protectionKnown = [...uniqueMoves.keys()].some(id => protectionMoves.includes(id.slice(5))) || /protect|quickguard|wideguard/.test(effectIds);
  const targets: string[] = []; const targetSources: string[] = [];
  if (protectionKnown) {
    const personal = [...uniqueMoves.keys()].some(id => !['move:quickguard', 'move:wideguard'].includes(id) && protectionMoves.includes(id.slice(5)));
    if (personal || effectIds.includes('protect')) { targets.push(ruleText('personal-protection')); targetSources.push('M09'); }
    if (uniqueMoves.has('move:quickguard') || uniqueMoves.has('move:wideguard') || /quickguard|wideguard/.test(effectIds)) { targets.push(ruleText('side-guards')); targetSources.push('M10'); }
  }
  const spread = [...uniqueMoves].filter(([, move]) => ['allAdjacent', 'allAdjacentFoes'].includes(move.target));
  if (spread.length) {
    targets.push(`Known spread categories: ${spread.map(([, move]) => `${move.name} = ${move.target}`).join('; ')}. ${ruleText('spread')}`);
    targetSources.push('C06', ...spread.map(([id]) => id));
  }
  if (allPokemon.some(p => p.fainted === true && p.slot !== null)) {
    targets.push(sentence('targets', 'An ordinary single-target attack whose opposing target faints')); targetSources.push('C05');
  }
  add('protection-and-targets', targets, targetSources);

  const fieldLines: string[] = []; const fieldSources: string[] = [];
  const observedField = Array.isArray(input.state.field) ? input.state.field.map(value => String(record(value).name)).filter(Boolean) : [];
  if (observedField.length) fieldLines.push(`Observed field: ${observedField.join(', ')}.`);
  for (const owner of owners) for (const { id, move } of owner.moves.filter(entry => fieldMove(entry.move))) {
    fieldLines.push(`${owner.name}'s ${move.name} has these field conditions: ${move.description}`); fieldSources.push(id);
  }
  const knownWeather = /weather|rain|sun|snow|sandstorm/i.test(`${effects} ${declaredAbilities.map(ability => definition(ability.id)).join(' ')}`);
  if (knownWeather) {
    const fireWater = [...uniqueMoves].filter(([, move]) => ['Fire', 'Water'].includes(move.type));
    if (fireWater.length) {
      fieldLines.push(`Known weather-sensitive types: ${fireWater.map(([, move]) => `${move.name} (${move.type})`).join(', ')}. ${sentence('weather', 'Rain multiplies Water')}`); fieldSources.push('M15', ...fireWater.map(([id]) => id));
    }
  }
  if (owners.some(owner => owner.pokemon.availableMegaForm)) {
    fieldLines.push(sentence('action-order', 'Ordinary voluntary switches'));
    fieldLines.push(sentence('mega', 'A supplied legal Mega declaration')); fieldSources.push('C03', 'C18');
  }
  const knownTerrainWords = canonical(`${effects} ${[...uniqueMoves.values()].map(move => `${move.name} ${move.description}`).join(' ')} ${declaredAbilities.map(ability => definition(ability.id)).join(' ')}`);
  for (const [name, id] of [['psychicterrain', 'M20'], ['electricterrain', 'M17'], ['grassyterrain', 'M18'], ['mistyterrain', 'M19']] as const) {
    if (!knownTerrainWords.includes(name)) continue;
    if (id === 'M20') {
      const positive = owners.flatMap(owner => owner.moves.filter(({ move }) => move.priority > 0).map(({ move }) => `${owner.name}'s ${move.name}`));
      if (positive.length) fieldLines.push(`Known positive-base-priority moves that must account for Psychic Terrain's conditional target protection: ${positive.join(', ')}.`);
    }
    fieldLines.push(...referenceParagraphs(knowledge, id)); fieldSources.push(id);
    fieldLines.push(sentence('type-and-status-immunities', 'Grounding can change')); fieldSources.push('C08', 'C09', 'C16');
  }
  if (effectIds.includes('tailwind') || uniqueMoves.has('move:tailwind')) { fieldLines.push(ruleText('tailwind')); fieldSources.push('M21'); }
  if (/reflect|lightscreen|auroraveil/.test(effectIds) || [...uniqueMoves.keys()].some(id => ['move:reflect', 'move:lightscreen', 'move:auroraveil'].includes(id))) {
    fieldLines.push(ruleText('screens')); fieldSources.push('M11');
  }
  add('field-to-known-moves', fieldLines, fieldSources);

  const ppLines: string[] = []; const ppSources: string[] = [];
  for (const owner of owners) {
    const projectedMoves = record(projectedById.get(owner.pokemon.id)).moves;
    const currentMoves = new Map((Array.isArray(projectedMoves) ? projectedMoves : []).map(value => {
      const move = record(value); return [move.id, record(move.pp)];
    }));
    const entries = owner.moves.map(({ id, move }) => {
      // The same authoritative projection as the current-state ledger: stale
      // stored PP remains unknown even if its historical value is numeric.
      const value = currentMoves.get(id) ?? {};
      return typeof value.current === 'number' ? `${move.name} ${value.current}/${typeof value.max === 'number' ? value.max : '?'}` : `${move.name} unknown`;
    });
    if (entries.length) { ppLines.push(`${owner.name} PP: ${entries.join(', ')}.`); ppSources.push('C04', ...owner.moves.map(move => move.id)); }
  }
  add('move-resources', ppLines, ppSources);
  if (uncertain) add('unknowns', ['Unrevealed moves, abilities, items, remaining durations and opposing pending choices stay unknown. These are conditional mechanical relationships, not a forecast of action order or success.'], []);

  const text = sections.map(section => section.text).join('\n');
  const sourceIds = unique(sections.flatMap(section => section.sourceIds));
  const sources = Object.fromEntries(sourceIds.map(id => {
    const source = knowledge.sources[id]; if (!source) throw new Error(`Missing mechanical relation provenance: ${id}.`);
    return [id, source];
  }));
  return { text, sections, audit: {
    version: 'mechanical-relations-v5', sourceHashes: knowledge.sourceHashes, sources,
    engineRevision: knowledge.wiki.manifest.showdownCommit, formatId: knowledge.wiki.manifest.formatId,
    textHash: digest(text), bytes: Buffer.byteLength(text), words: text.split(/\s+/).filter(Boolean).length,
    sections: sections.map(section => ({ id: section.id, sourceIds: section.sourceIds, textHash: digest(section.text) })),
    ppPolicy: 'Uses projectObservation current-request/freshness policy; historical or unconfirmed stored PP remains unknown.',
    uncertainty: uncertain, principles: 'Bound mechanical definitions only. No score, damage calculation, hidden trained stats, future command, recommended action or benchmark label is computed.',
  } };
}
