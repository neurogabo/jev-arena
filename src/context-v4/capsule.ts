import type { ConciseKnowledge } from '../knowledge/concise.js';
import type { DecisionInput } from '../showdown/types.js';
import { projectFocusedPosition } from './position.js';

type Row = Record<string, any>;
const number = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const statusNames: Record<string, string> = { brn: 'burned', psn: 'poisoned', tox: 'badly poisoned', par: 'paralyzed', slp: 'asleep', frz: 'frozen' };
const statNames: Record<string, string> = { atk: 'Attack', def: 'Defense', spa: 'Special Attack', spd: 'Special Defense', spe: 'Speed', accuracy: 'accuracy', evasion: 'evasion' };
const effectsText = (effects: Row[]) => effects.map(effect => `${effect.name}${
  number(effect.sinceTurn) ? ` since turn ${effect.sinceTurn}` : ''}${
  number(effect.remainingTurns) ? ` (${effect.remainingTurns} turns left)` : ''}`).join(', ');

/** A small optional supplement, never a replacement for the full player log. */
export function buildPositionCapsule(input: DecisionInput, knowledge: ConciseKnowledge): {
  text: string; state: unknown; audit: Record<string, unknown>;
} {
  const position = projectFocusedPosition(input, knowledge);
  const source = position.state as Row;
  const sideAudit: Row = {};
  const sides = Object.fromEntries(['us', 'opponent'].map(side => {
    const original = source.sides[side] as Row;
    const exactCounts = number(original.livingCount) && number(original.livingReserveCount);
    const fainted = original.fainted.length + original.pokemon.filter((mon: Row) => mon.fainted === true).length;
    const pokemon = (original.pokemon as Row[]).filter(mon => mon.fainted !== true).map(mon => ({
      name: mon.name, species: mon.species, position: mon.position,
      survivalKnown: mon.fainted === false, hp: mon.hp,
      ...(typeof mon.status === 'string' && mon.status !== 'none' ? { status: mon.status } : {}),
      ...(mon.stages && Object.keys(mon.stages.nonzero).length ? { stages: mon.stages.nonzero } : {}),
      ...(mon.ability ? { ability: mon.ability } : {}),
      ...(mon.item !== null ? { item: mon.item } : {}),
      ...(Array.isArray(mon.effects) && mon.effects.length ? { effects: mon.effects } : {}),
      ...(mon.megaEvolved === true ? { megaEvolved: true } : {}),
    }));
    sideAudit[side] = { participantListComplete: original.complete, exactCounts,
      omittedFaintedDetails: fainted,
      knownEffectCoverage: { side: Array.isArray(original.effects), pokemon: Object.fromEntries(
        (original.pokemon as Row[]).filter(mon => mon.fainted !== true).map(mon => [mon.name, Array.isArray(mon.effects)])) },
      knownZeroStatusAndStagesLeftInLog: true };
    return [side, { complete: original.complete, livingCount: exactCounts ? original.livingCount : null,
      livingReserveCount: exactCounts ? original.livingReserveCount : null,
      faintedCount: exactCounts ? fainted : null, pokemon,
      ...(Array.isArray(original.effects) && original.effects.length ? { effects: original.effects } : {}) }];
  })) as Record<string, Row>;
  const state = { scope: 'Current observed position (other details remain in the log).',
    phase: input.phase, turn: source.turn, sides,
    ...(Array.isArray(source.field) && source.field.length ? { field: source.field } : {}),
    ...(input.phase === 'replacement' ? { replace: source.replace } : {}) };
  const lines = [state.scope];
  if (input.phase === 'replacement') lines.push(`Replacement${number(state.turn) ? ` on turn ${state.turn}` : ''}: ${
    Array.isArray(state.replace) ? state.replace.join(' and ') || 'no position requested' : 'positions unknown'}.`);
  else if (number(state.turn)) lines.push(`Turn ${state.turn}${input.phase === 'team-preview' ? ' team preview' : ''}.`);
  for (const side of ['us', 'opponent']) {
    const value = sides[side]!;
    const label = side === 'us' ? 'You' : 'Opponent';
    lines.push(`${label}: ${value.livingCount === null ? 'survivor and reserve totals unknown' :
      `${value.livingCount} surviving Pokemon; ${value.livingReserveCount} living reserve${value.livingReserveCount === 1 ? '' : 's'}; ${value.faintedCount} fainted`}.`);
    for (const mon of value.pokemon as Row[]) {
      const details = [mon.name === mon.species ? mon.name : `${mon.name} (${mon.species})`, mon.position ?? 'position unknown'];
      if (mon.hp) details.push('current' in mon.hp ? `${mon.hp.current}/${mon.hp.max} HP` : `${mon.hp.publicPercent}% displayed HP`);
      else details.push('HP unknown');
      if (!mon.survivalKnown) details.push('survival unknown');
      if (mon.status) details.push(statusNames[mon.status] ?? mon.status);
      if (mon.stages) details.push(...Object.entries(mon.stages).map(([stat, value]) => `${statNames[stat] ?? stat} ${Number(value) > 0 ? '+' : ''}${value}`));
      if (mon.ability) details.push(`ability ${mon.ability}`);
      if (mon.item !== undefined) details.push(mon.item === 'none' ? 'no item' : `holding ${mon.item}`);
      if (mon.megaEvolved) details.push('Mega evolved');
      if (mon.effects) details.push(`effects: ${effectsText(mon.effects)}`);
      lines.push(`${details.join('; ')}.`);
    }
    if (value.effects) lines.push(`${label} side effects: ${effectsText(value.effects)}.`);
  }
  if (Array.isArray(state.field)) lines.push(`Field: ${effectsText(state.field)}.`);
  const text = lines.join('\n');
  return { text, state, audit: { version: 'position-capsule-v4-phase-b', textBytes: Buffer.byteLength(text),
    stateBytes: Buffer.byteLength(JSON.stringify(state)), sourcePositionBytes: position.audit.textBytes,
    partialSupplement: true, participantCoverage: sideAudit,
    fieldEffectsKnown: Array.isArray(source.field), omittedFieldsRemainInUnchangedLog: [
      'Fainted participant identities and sets', 'Moves and PP', 'Trained statistics', 'Levels, gender, nature and types',
      'Known zero stages and absent statuses/effects', 'Entry eligibility, protection counters and possible Mega details', 'History and transport identity'],
    currentAbilitiesAndItemsPreserved: true, noActionEvaluation: true } };
}
