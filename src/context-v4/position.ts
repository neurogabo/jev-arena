import { createHash } from 'node:crypto';
import type { ConciseKnowledge } from '../knowledge/concise.js';
import { prepareSelectiveKnowledge } from '../knowledge/selective.js';
import { projectObservation } from '../showdown/concise-observation.js';
import type { DecisionInput } from '../showdown/types.js';

type Row = Record<string, any>;
const record = (value: unknown): Row => value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
const rows = (value: unknown): Row[] => Array.isArray(value) ? value.map(record) : [];
const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter(item => typeof item === 'string') : [];
const numeric = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const statNames: Record<string, string> = { hp: 'HP', atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Speed', accuracy: 'accuracy', evasion: 'evasion' };
const statusNames: Record<string, string> = { brn: 'burned', psn: 'poisoned', tox: 'badly poisoned', par: 'paralyzed', slp: 'asleep', frz: 'frozen' };
const signed = (value: number) => value > 0 ? `+${value}` : String(value);

function effects(value: unknown): Row[] | null {
  if (!Array.isArray(value)) return null;
  return value.map(record).map(effect => ({ name: String(effect.name ?? 'unknown effect'),
    ...(numeric(effect.sinceTurn) ? { sinceTurn: effect.sinceTurn } : {}),
    ...(numeric(effect.remainingTurns) ? { remainingTurns: effect.remainingTurns } : {}) }));
}
const effectText = (values: Row[]) => values.length ? values.map(effect => `${effect.name}${
  effect.sinceTurn !== undefined ? ` since turn ${effect.sinceTurn}` : ''}${
  effect.remainingTurns !== undefined ? ` (${effect.remainingTurns} turns left)` : ''}`).join(', ') : 'none';
const statsText = (stats: Row) => Object.entries(stats).map(([key, value]) => `${statNames[key] ?? key} ${value ?? '?'}`).join(', ');

/**
 * Extra, partial CURRENT digest for a benchmark that still sends the unchanged
 * full player log and menu. It is not a replacement observer or standalone
 * battle state. Only authorized observation fields and verified names are used.
 * No action is ranked, suggested, simulated, or removed here.
 */
export function projectFocusedPosition(input: DecisionInput, knowledge: ConciseKnowledge): {
  state: unknown; text: string; audit: Record<string, unknown>;
} {
  const source = input.state;
  const ownSide = record(source.request).ourSide;
  if (ownSide !== 'p1' && ownSide !== 'p2') throw new Error('Focused position requires an explicit controlled side.');
  if (!Array.isArray(source.pokemon) || !source.pokemon.length) throw new Error('Focused position requires observed participants.');
  const original = rows(source.pokemon);
  if (original.some(mon => mon.side !== 'p1' && mon.side !== 'p2')) throw new Error('Observed participant has an unknown side.');
  const pruneFainted = prepareSelectiveKnowledge(input, knowledge).audit.faintedDetailsPruned === true;
  const names = { ...Object.fromEntries(Object.entries(knowledge.entities).map(([id, entity]) => [id, entity.name])), ...record(source.entityNames) };
  const name = (id: unknown) => typeof id === 'string' ? String(names[id] ?? id.replace(/^[^:]+:/, '')) : null;
  const projected = projectObservation({ ...input, state: { ...source, entityNames: names } });
  const byId = new Map(rows(projected.battle.participants).map(mon => [mon.id, mon]));
  const mode = record(source.informationPolicy).mode;
  const retainedIds: string[] = [];
  const omittedDeadIds: string[] = [];

  function pokemon(sourceMon: Row): Row {
    retainedIds.push(sourceMon.id);
    const mon = byId.get(sourceMon.id)!;
    const own = sourceMon.side === ownSide;
    const hp = record(sourceMon.hp);
    const exact = record(hp.exact);
    const stages = sourceMon.statStages === null || sourceMon.statStages === undefined ? null :
      Object.fromEntries(Object.entries(record(sourceMon.statStages)).map(([stat, value]) => [stat, numeric(value) ? value : null]));
    const compactStages = stages && Object.keys(stages).length ? {
      nonzero: Object.fromEntries(Object.entries(stages).filter(([, value]) => numeric(value) && value !== 0)),
      unknown: Object.keys(statNames).filter(stat => stat !== 'hp' && !(stat in stages) || stat in stages && stages[stat] === null),
    } : null;
    const item = record(sourceMon.item);
    const moves = rows(mon.moves).map(move => {
      const pp = record(move.pp); const request = record(move.request);
      return { name: move.name,
        ...(numeric(pp.current) ? { pp: { current: pp.current, ...(numeric(pp.max) ? { max: pp.max } : {}) } } : {}),
        ...(typeof request.disabled === 'boolean' ? { disabled: request.disabled } : {}) };
    });
    const slot = sourceMon.slot;
    const mega = record(sourceMon.availableMegaForm);
    return {
      name: String(sourceMon.name ?? mon.species), species: mon.species,
      position: input.phase === 'team-preview' ? 'unassigned' : slot === 0 ? 'left' : slot === 1 ? 'right' : slot === null ? 'reserve' : null,
      fainted: typeof sourceMon.fainted === 'boolean' ? sourceMon.fainted : null,
      ...(numeric(sourceMon.level) ? { level: sourceMon.level } : {}),
      ...(typeof sourceMon.gender === 'string' && sourceMon.gender ? { gender: sourceMon.gender } : {}),
      types: Array.isArray(sourceMon.typeIds) ? strings(sourceMon.typeIds).map(name) : null,
      hp: own && numeric(exact.current) && numeric(exact.max) ? { current: exact.current, max: exact.max } :
        numeric(hp.percent) ? { publicPercent: hp.percent } : null,
      status: sourceMon.status === null ? 'none' : typeof sourceMon.status === 'string' ? sourceMon.status : null,
      stages: compactStages,
      ability: name(sourceMon.abilityId),
      item: item.status === 'none' ? 'none' : item.status === 'known' ? name(item.cardId) : null,
      stats: sourceMon.stats && typeof sourceMon.stats === 'object' ? mon.trainedStats : null,
      ...(typeof record(sourceMon.initialSetDetails).nature === 'string' ? { nature: sourceMon.initialSetDetails.nature } : {}),
      movesComplete: sourceMon.movesComplete === true || (sourceMon.movesComplete !== false && mode === 'revealed-demo'),
      moves, effects: effects(sourceMon.effects),
      ...(typeof sourceMon.firstActionOpportunity === 'boolean' ? { firstAction: sourceMon.firstActionOpportunity } : {}),
      ...(numeric(sourceMon.protectChain) ? { protectionChain: sourceMon.protectChain } : {}),
      ...(typeof sourceMon.megaEvolved === 'boolean' ? { megaEvolved: sourceMon.megaEvolved } : {}),
      ...(typeof mega.speciesId === 'string' ? { possibleMega: { species: name(mega.speciesId),
        types: Array.isArray(mega.typeIds) ? strings(mega.typeIds).map(name) : null, ability: name(mega.abilityId),
        stats: record(mon.availableMegaForm).trainedStats ?? null } } : {}),
    };
  }

  const sides = Object.fromEntries(['us', 'opponent'].map(side => {
    const originalSide = side === 'us' ? ownSide : ownSide === 'p1' ? 'p2' : 'p1';
    const members = original.filter(mon => mon.side === originalSide);
    const disclosedIds = source[side === 'us' ? 'ownSelectedIds' : 'opponentSelectedIds'];
    const selected = strings(disclosedIds);
    const complete = selected.length > 0 && new Set(selected).size === selected.length &&
      selected.length === members.length && members.every(mon => selected.includes(mon.id));
    const countsComplete = complete && input.phase !== 'team-preview' && members.every(mon =>
      typeof mon.fainted === 'boolean' && (mon.slot === null || mon.slot === 0 || mon.slot === 1));
    const observedLivingCount = members.filter(mon => mon.fainted === false).length;
    const observedLivingReserveCount = input.phase === 'team-preview' ? 0 :
      members.filter(mon => mon.fainted === false && mon.slot === null).length;
    const fainted = pruneFainted ? members.filter(mon => mon.fainted === true).map(mon => {
      omittedDeadIds.push(mon.id); return { name: mon.name, species: name(mon.speciesId) };
    }) : [];
    const survivors = members.filter(mon => !pruneFainted || mon.fainted !== true)
      .sort((a, b) => (numeric(a.slot) ? a.slot : 2) - (numeric(b.slot) ? b.slot : 2) || String(a.name).localeCompare(String(b.name)));
    return [side, { complete, livingCount: countsComplete ? observedLivingCount : null,
      livingReserveCount: countsComplete ? observedLivingReserveCount : null,
      ...(!countsComplete ? { observedAtLeast: { living: observedLivingCount, livingReserves: observedLivingReserveCount } } : {}),
      fainted, pokemon: survivors.map(pokemon),
      effects: effects(record(source.sideConditions)[originalSide]),
      megaSpent: members.some(mon => mon.megaEvolved === true) ? true : complete && members.every(mon => mon.megaEvolved === false) ? false : null }];
  })) as Record<string, Row>;
  const constraints = record(source.actionConstraints);
  const state = {
    scope: 'Partial current digest; full history and complete legal actions remain in the accompanying Showdown log and menu.',
    unknown: 'Omitted details and null fields are unknown, not absent. Unknown effect durations are not indefinite. Public HP percentages are rounded. Stats are before stages.',
    phase: input.phase, turn: numeric(record(source.request).turn) ? record(source.request).turn : null,
    sides, field: effects(source.field),
    ...(input.phase === 'replacement' ? { replace: Array.isArray(constraints.forceSwitch)
      ? constraints.forceSwitch.flatMap((required: unknown, index: number) => required === true ? [index === 0 ? 'left' : 'right'] : []) : null } : {}),
  };
  const lines = [state.scope, state.unknown,
    `${state.turn === null ? 'Current' : `Turn ${state.turn}`} ${input.phase}${'replace' in state && state.replace ? `; replace ${state.replace.join(' and ') || 'no position'}` : ''}.`];
  for (const side of ['us', 'opponent']) {
    const value = sides[side]!;
    const label = side === 'us' ? 'Your side' : 'Opponent';
    lines.push(`${label}: ${value.complete ? 'all selected participants accounted for' : 'only observed participants; other participants unknown'}.${
      value.livingCount === null ? ` Observed at least ${value.observedAtLeast.living} surviving participant(s) and ${value.observedAtLeast.livingReserves} living reserve(s); exact counts unknown.` :
        ` ${value.livingCount} surviving participant${value.livingCount === 1 ? '' : 's'}; ${value.livingReserveCount} living reserve${value.livingReserveCount === 1 ? '' : 's'}.`}${
      value.fainted.length ? ` Fainted (${value.fainted.length}): ${value.fainted.map((mon: Row) => mon.name === mon.species ? mon.name : `${mon.name} (${mon.species})`).join(', ')}.` : ''}${
      value.effects === null ? '' : ` Side effects: ${effectText(value.effects)}.`}${
      value.megaSpent === null ? '' : ` Mega used: ${value.megaSpent ? 'yes' : 'no'}.`}`);
    for (const mon of value.pokemon as Row[]) {
      const details = [mon.name === mon.species ? mon.name : `${mon.name} (${mon.species})`];
      if (mon.position) details.push(mon.position);
      if (mon.level !== undefined) details.push(`L${mon.level}`);
      if (mon.gender) details.push(mon.gender);
      if (mon.types) details.push(mon.types.join('/'));
      if (mon.hp) details.push('current' in mon.hp ? `${mon.hp.current}/${mon.hp.max} HP` : `${mon.hp.publicPercent}% displayed HP`);
      if (mon.fainted !== null) details.push(mon.fainted ? 'fainted' : 'not fainted');
      if (mon.status !== null) details.push(mon.status === 'none' ? 'status none' : statusNames[mon.status] ?? mon.status);
      if (mon.stages) details.push(`stages ${Object.entries(mon.stages.nonzero).map(([stat, value]) => `${statNames[stat] ?? stat} ${signed(Number(value))}`).join(', ') || 'no observed nonzero stages'}${mon.stages.unknown.length ? `; unknown ${mon.stages.unknown.join(', ')}` : '; others zero'}`);
      if (mon.ability) details.push(`ability ${mon.ability}`);
      if (mon.item !== null) details.push(`item ${mon.item}`);
      if (mon.stats) details.push(`stats ${statsText(mon.stats)}`);
      if (mon.nature) details.push(`${mon.nature} nature`);
      lines.push(`${details.join('; ')}.`);
      lines.push(`Moves ${mon.movesComplete ? '(complete)' : '(known only; others unknown)'}: ${mon.moves.map((move: Row) => `${move.name}${
        move.pp ? ` ${move.pp.current}${move.pp.max !== undefined ? `/${move.pp.max}` : ''} PP` : ''}${
        move.disabled === true ? ' disabled' : move.disabled === false ? ' enabled' : ''}`).join(', ') || 'none observed'}.${
        mon.effects === null ? '' : ` Effects: ${effectText(mon.effects)}.`}${
        mon.firstAction === undefined ? '' : ` First action opportunity: ${mon.firstAction ? 'yes' : 'no'}.`}${
        mon.protectionChain === undefined ? '' : ` Protection chain: ${mon.protectionChain}.`}${
        mon.megaEvolved === undefined ? '' : ` Already Mega: ${mon.megaEvolved ? 'yes' : 'no'}.`}`);
      if (mon.possibleMega) {
        const mega = mon.possibleMega;
        lines.push(`Possible Mega: ${mega.species}${mega.types ? ` (${mega.types.join('/')})` : ''}${mega.ability ? `; ability ${mega.ability}` : ''}${mega.stats ? `; stats ${statsText(mega.stats)}` : ''}. This is an available form, not a committed action.`);
      }
    }
  }
  if (state.field !== null) lines.push(`Field: ${effectText(state.field)}.`);
  const text = lines.join('\n');
  return { state, text, audit: { version: 'focused-position-v4', inputFingerprint: digest(input),
    stateBytes: Buffer.byteLength(JSON.stringify(state)), textBytes: Buffer.byteLength(text),
    faintedDetailsPruned: pruneFainted, retainedPokemonIds: retainedIds, summarizedFaintedIds: omittedDeadIds,
    allCandidatesPreservedByCaller: 'This projection never changes candidates; callers must retain the original log and complete candidate list.',
    excluded: ['Transport identities', 'Pending commands', 'Seeds', 'Redundant event history', 'Repeated provenance', 'Unselected wiki facts'],
    currentDigestOnly: true } };
}
