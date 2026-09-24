import { createHash } from 'node:crypto';
import type { ConciseKnowledge } from '../knowledge/concise.js';
import type { DecisionInput } from '../showdown/types.js';
import { projectFocusedPosition } from '../context-v4/position.js';

type Row = Record<string, any>;
const record = (value: unknown): Row => value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
const rows = (value: unknown): Row[] => Array.isArray(value) ? value.map(record) : [];
const numeric = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const signed = (value: number) => value > 0 ? `+${value}` : String(value);
const statNames: Record<string, string> = { hp: 'HP', atk: 'Attack', def: 'Defense', spa: 'Special Attack', spd: 'Special Defense', spe: 'Speed', accuracy: 'accuracy', evasion: 'evasion' };
const statuses: Record<string, string> = { brn: 'burned', psn: 'poisoned', tox: 'badly poisoned', par: 'paralyzed', slp: 'asleep', frz: 'frozen' };
const positions = ['left', 'right'];
const statsText = (value: Row) => Object.entries(value).map(([stat, amount]) => `${statNames[stat] ?? stat} ${amount ?? 'unknown'}`).join(', ');
const hpText = (mon: Row) => mon.hp ? 'current' in mon.hp ? `${mon.hp.current}/${mon.hp.max} HP` : `${mon.hp.publicPercent}% displayed HP` : 'unknown HP';
const effectsText = (value: Row[]) => value.map(effect => `${effect.name}${numeric(effect.sinceTurn) ? ` since turn ${effect.sinceTurn}` : ''}${numeric(effect.remainingTurns) ? `, ${effect.remainingTurns} turns remaining` : ''}`).join('; ');

/** Exact observation and offered-action facts, without outcome prediction or scoring. */
export function prepareDecisionFacts(input: DecisionInput, knowledge: ConciseKnowledge): {
  situation: string; ledger: string; actions: { id: string; description: string; facts: string[] }[]; audit: Record<string, unknown>;
} {
  if (input.phase === 'team-preview') throw new Error('V5 decision facts do not yet support Team Preview.');
  const position = projectFocusedPosition(input, knowledge);
  const projected = position.state as Row;
  const sourcePokemon = rows(input.state.pokemon);
  const ownSide = record(input.state.request).ourSide;
  const otherSide = ownSide === 'p1' ? 'p2' : 'p1';
  const constraints = record(input.state.actionConstraints);
  const menus = rows(constraints.active);
  const activeCount = input.phase === 'replacement' && Array.isArray(constraints.forceSwitch) ? constraints.forceSwitch.length : menus.length;
  if (activeCount < 1 || activeCount > 2) throw new Error('V5 facts require the current one- or two-position action request.');
  if (!input.candidates.length || new Set(input.candidates.map(action => action.id)).size !== input.candidates.length) throw new Error('V5 facts require unique, nonempty offered actions.');
  const at = (side: string, slot: number) => {
    const found = sourcePokemon.filter(mon => mon.side === side && mon.slot === slot);
    if (found.length > 1) throw new Error('Ambiguous current position identity.');
    return found[0];
  };
  const monName = (mon: Row) => String(mon.name ?? 'unnamed Pokemon');
  const projectedMon = (mon: Row) => rows(projected.sides[mon.side === ownSide ? 'us' : 'opponent'].pokemon)
    .find(current => current.name === mon.name);
  const sourceIds = new Set<string>();
  const move = (id: string) => {
    const found = knowledge.entities[id];
    if (!found || !numeric(found.priority) || typeof found.type !== 'string' || typeof found.category !== 'string') throw new Error(`Missing verified move facts: ${id}.`);
    sourceIds.add(id); return found;
  };
  const moveFacts = (entry: Row) => `base priority ${signed(entry.priority)}, ${entry.type}, ${entry.category}`;
  const situation: string[] = [];
  for (const side of ['us', 'opponent']) {
    const value = projected.sides[side] as Row;
    const living = rows(value.pokemon).filter(mon => mon.fainted !== true);
    for (const mon of living) {
      const owner = side === 'us' ? 'You control' : 'The opponent controls';
      const name = mon.name === mon.species ? mon.name : `${mon.name} (${mon.species})`;
      const clauses = [`${owner} ${name} at ${hpText(mon)}${mon.position ? ` in ${mon.position === 'reserve' ? 'reserve' : `the ${mon.position} position`}` : '; position unknown'}`];
      if (mon.fainted !== false) clauses.push('survival state unknown');
      if (mon.status && mon.status !== 'none') clauses.push(statuses[mon.status] ?? mon.status);
      if (mon.stages) clauses.push(...Object.entries(mon.stages.nonzero).map(([stat, stage]) => `${statNames[stat] ?? stat} stage ${signed(Number(stage))}`));
      if (Array.isArray(mon.effects) && mon.effects.length) clauses.push(`active effects: ${effectsText(mon.effects)}`);
      situation.push(`${clauses.join('; ')}.`);
    }
    const owner = side === 'us' ? 'Your side' : 'The opponent';
    if (value.livingCount !== null) situation.push(`${owner} has ${value.livingCount === 1 ? 'one Pokemon remaining' : `${value.livingCount} Pokemon remaining`} and ${value.livingReserveCount === 0 ? 'no living reserves' : `${value.livingReserveCount} living reserves`}.`);
    else situation.push(`${owner}'s total surviving Pokemon and reserves are unknown.`);
    if (Array.isArray(value.effects) && value.effects.length) situation.push(`${owner} side effects: ${effectsText(value.effects)}.`);
  }
  if (Array.isArray(projected.field) && projected.field.length) situation.push(`Field: ${effectsText(projected.field)}.`);
  if (input.phase === 'replacement') situation.push(`A replacement is requested for ${projected.replace?.join(' and ') ?? 'unknown positions'}; this does not identify whether the turn has ended.`);

  const ledger: string[] = ['Known current facts only. HP percentages are displayed values; trained stats are before stages. Unknown is not absent.'];
  for (const side of ['us', 'opponent']) for (const mon of rows(projected.sides[side].pokemon)) {
    const actor = `${side === 'us' ? 'Your' : 'Opposing'} ${mon.name}${mon.name !== mon.species ? ` (${mon.species})` : ''}`;
    const source = sourcePokemon.find(candidate => candidate.side === (side === 'us' ? ownSide : otherSide) && candidate.name === mon.name)!;
    ledger.push(`${actor}: ${mon.types?.join('/') ?? 'unknown types'}; current ability ${mon.ability ?? 'unknown'}; held item ${mon.item ?? 'unknown'}; status ${mon.status === null ? 'unknown' : mon.status === 'none' ? 'none' : statuses[mon.status] ?? mon.status}.`);
    if (mon.stats) ledger.push(`${actor} trained stats: ${statsText(mon.stats)}.`);
    else ledger.push(`${actor} trained stats are unknown.`);
    const timing = [mon.firstAction !== undefined ? `first action opportunity ${mon.firstAction ? 'yes' : 'no'}` : '',
      mon.protectionChain !== undefined ? `protection chain ${mon.protectionChain}` : ''].filter(Boolean);
    if (timing.length) ledger.push(`${actor}: ${timing.join('; ')}.`);
    const known = Array.isArray(source.knownMoveIds) ? [...source.knownMoveIds] as string[] : [];
    if (source.side === ownSide && numeric(source.slot)) for (const requested of rows(menus[source.slot]?.moves)) {
      if (typeof requested.moveId === 'string' && !known.includes(requested.moveId)) known.push(requested.moveId);
    }
    const moveRows = known.map(id => {
      if (id === 'move:recharge') return 'Recharge: current request requires a recharge action';
      const entry = move(id); const current = rows(mon.moves).find(candidate => candidate.name === entry.name);
      return `${entry.name} (${moveFacts(entry)}${current?.pp ? `; PP ${current.pp.current}${current.pp.max !== undefined ? `/${current.pp.max}` : ''}` : '; current PP unknown'}${current?.disabled === true ? '; disabled' : current?.disabled === false ? '; enabled' : ''})`;
    });
    ledger.push(`${actor}'s ${mon.movesComplete ? 'complete move set' : 'known moves (additional moves unknown)'}: ${moveRows.join('; ') || 'no moves observed'}.`);
    if (mon.possibleMega) ledger.push(`${actor}'s possible Mega form, conditional on choosing and executing Mega Evolution: ${mon.possibleMega.species}; types ${mon.possibleMega.types?.join('/') ?? 'unknown'}; ability ${mon.possibleMega.ability ?? 'unknown'}; ${mon.possibleMega.stats ? `trained stats ${statsText(mon.possibleMega.stats)}` : 'trained stats unknown'}. This is not its currently observed form.`);
  }

  const switchNames = new Map<number, string>();
  const switchIndices = new Map<string, number>();
  function targetFact(side: string, slot: number, actorSlot: number): string {
    const relation = side !== ownSide ? 'opposing' : actorSlot === slot ? 'own actor' : 'allied';
    const occupant = at(side, slot);
    if (occupant) return `${relation} ${positions[slot]} position currently contains ${monName(occupant)}${occupant.fainted === true ? ', fainted with no living occupant' : occupant.fainted === false ? ', not fainted' : ', survival unknown'}`;
    const roster = projected.sides[side === ownSide ? 'us' : 'opponent'] as Row;
    const completePositions = roster.complete && sourcePokemon.filter(mon => mon.side === side).every(mon => mon.slot === null || mon.slot === 0 || mon.slot === 1);
    return `${relation} ${positions[slot]} position ${completePositions ? 'currently has no occupant' : 'has an unknown current occupant'}`;
  }
  const actions = input.candidates.map(action => {
    const commands = action.command.split(', ');
    const descriptions = action.description.split('; ');
    if (commands.length !== activeCount || descriptions.length !== activeCount) throw new Error('Action parts do not match the current request positions.');
    const facts = commands.flatMap((command, slot) => {
      const actor = at(ownSide, slot);
      const actorName = actor ? monName(actor) : `your ${positions[slot]} position`;
      if (command === 'pass') return [`${actorName}: no action is supplied for this position in this choice.`];
      if (!actor) throw new Error('Offered action has no uniquely identified current actor.');
      if (!descriptions[slot]!.startsWith(`${actorName}: `)) throw new Error('Action description actor does not match the observed position.');
      const switching = /^switch ([1-6])$/.exec(command);
      if (switching) {
        const prefix = `${actorName}: switch to `;
        if (!descriptions[slot]!.startsWith(prefix)) throw new Error('Switch description does not identify a destination.');
        const destinationName = descriptions[slot]!.slice(prefix.length);
        const destinations = sourcePokemon.filter(mon => mon.side === ownSide && mon.name === destinationName && mon.slot === null && mon.fainted === false);
        if (destinations.length !== 1) throw new Error('Switch destination is not a uniquely observed living reserve.');
        const index = Number(switching[1]);
        if (switchNames.has(index) && switchNames.get(index) !== destinationName || switchIndices.has(destinationName) && switchIndices.get(destinationName) !== index) throw new Error('Inconsistent switch index and observed reserve identity.');
        switchNames.set(index, destinationName); switchIndices.set(destinationName, index);
        return [`${actorName}: this choice supplies ${destinationName} as the ${input.phase === 'replacement' ? 'replacement' : 'switch-in'} for your ${positions[slot]} position. ${destinationName} is currently a living reserve.`];
      }
      if (input.phase !== 'move') throw new Error('A replacement choice unexpectedly contains a move.');
      const attacking = /^move ([1-4])(?: (-?[12]))?(?: (mega|megax|megay))?$/.exec(command);
      if (!attacking) throw new Error('Unsupported offered action syntax.');
      const requested = rows(menus[slot]?.moves);
      const fallback = requested.length > 0 && requested.every(candidate => candidate.disabled || candidate.pp === 0);
      const selected = fallback && attacking[1] === '1' ? { moveId: 'move:struggle', target: 'randomNormal' } : requested[Number(attacking[1]) - 1];
      if (!selected || typeof selected.moveId !== 'string') throw new Error('Move index is absent from the current request.');
      const entry = selected.moveId === 'move:recharge' ? null : move(selected.moveId);
      const moveName = entry?.name ?? 'Recharge';
      if (!descriptions[slot]!.startsWith(`${actorName}: ${moveName} -> `)) throw new Error('Action description move does not match the current request index.');
      const result = [`${actorName}: ${moveName}${entry ? ` has ${moveFacts(entry)}` : ' is the recharge action required by the current request'}.`];
      if (attacking[2]) {
        const target = Number(attacking[2]);
        result.push(`Selected target: ${targetFact(target > 0 ? otherSide : ownSide, Math.abs(target) - 1, slot)}. This describes its present occupant, not its occupant at execution.`);
      } else {
        const patterns: Record<string, string> = { self: 'the user', allySide: 'your side', foeSide: 'the opposing side',
          all: 'the field', allAdjacent: 'all adjacent Pokemon', allAdjacentFoes: 'all adjacent opponents',
          randomNormal: 'an automatically selected opposing target', scripted: 'the move-specific automatic target' };
        if (!patterns[selected.target]) throw new Error('Move without explicit target lacks a supported request target pattern.');
        result.push(`Request target pattern: ${patterns[selected.target]}.`);
      }
      if (attacking[3]) {
        const mega = projectedMon(actor)?.possibleMega;
        if (!mega || (attacking[3] !== 'mega' && !String(mega.species).toLowerCase().endsWith(attacking[3].slice(-1)))) throw new Error('Requested Mega variant has no corresponding disclosed possible form.');
        result.push(`${actorName}: this choice requests Mega Evolution to ${mega.species}, with possible types ${mega.types?.join('/') ?? 'unknown'} and ability ${mega.ability ?? 'unknown'}. It is not an already observed transformation.`);
      }
      return result;
    });
    return { id: action.id, description: action.description, facts };
  });
  return { situation: situation.join(' '), ledger: ledger.join('\n'), actions,
    audit: { version: 'decision-facts-v5', inputHash: hash(input), actionUniverseHash: hash(input.candidates),
      candidateCount: actions.length, sourceIds: [...sourceIds].sort(), wikiSourceHashes: knowledge.sourceHashes,
      mapping: 'Move index uses the current active request. Switch index uses exact authorized menu destination and unique observed reserve, checked consistently across the full menu.',
      switchBindings: [...switchNames].map(([index, name]) => ({ index, name })),
      noOutcomePrediction: true, positionsAreCurrentNotFuture: true, originalActionOrderPreserved: true,
      fullLogRequired: true, positionAudit: position.audit } };
}
