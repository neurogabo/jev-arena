import assert from 'node:assert/strict';
import type { SystemOneRequest } from '@typesafe-ai/sdk';
import { assertBudget } from '../context.js';
import type { ConciseKnowledge } from '../knowledge/concise.js';
import { readChoice, type LiveQuery } from '../live-sim/tournament.js';
import type { Config } from '../schema.js';
import { formatId, loadEngine } from '../showdown/engine.js';
import type { PlainSet, StatBlock } from '../showdown/types.js';
import { buildSimHypotheses } from '../sim-v1/hypotheses.js';
import type { HypothesisSet, SimObservation } from '../sim-v1/types.js';
import { digest } from '../wiki.js';

type Mon = Record<string, any>;
type Candidate = { id: string; set: PlainSet; source: string; adjustedToReveals: boolean };
type Entry = { mon: Mon; candidates: Candidate[]; rejected: number };
const stats = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const;
const id = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
const short = (value: string) => value.slice(value.indexOf(':') + 1);
const refs = (text: string, kind: string) => [...text.matchAll(new RegExp(`\\[${kind}:([a-z0-9]+)\\]`, 'g'))].map(match => match[1]!);

/** Public wiki templates and their explicitly listed single-slot alternatives.
 * No catalog, assigned team ID, opponent request or live Battle is accepted.
 */
export function wikiCandidates(text: string, species: any, dex: any): { set: PlainSet; source: string }[] {
  const result: { set: PlainSet; source: string }[] = [];
  for (const match of text.matchAll(/### Build (\d+)([\s\S]*?)(?=### Build |## Battle interpretation|$)/g)) {
    const body = match[2]!;
    const values = body.match(/\| Allocated SP \|([^\r\n]+)/)?.[1]?.split('|').map(v => v.trim()).filter(Boolean).map(Number);
    if (!values || values.length !== 6 || values.some(v => !Number.isInteger(v) || v < 0 || v > 32) || values.reduce((a, b) => a + b, 0) > 66) continue;
    const set: PlainSet = { name: species.name, species: species.name, level: 50,
      ability: refs(body.match(/\*\*Ability:\*\* ([^\r\n]+)/)?.[1] ?? '', 'ability')[0] ?? '',
      item: refs(body.match(/\*\*Item:\*\* ([^\r\n]+)/)?.[1] ?? '', 'item')[0] ?? '',
      nature: body.match(/\*\*Nature:\*\* ([A-Za-z]+)/)?.[1] ?? '',
      moves: refs(body.match(/\*\*Moves:\*\* ([^\r\n]+)/)?.[1] ?? '', 'move'),
      evs: Object.fromEntries(stats.map((stat, i) => [stat, values[i]!])) as StatBlock };
    if (set.moves.length !== 4 || !dex.natures.get(set.nature).exists) continue;
    const source = `pokemon:${species.id}#build-${match[1]}`;
    result.push({ set, source });
    for (const item of refs(body.match(/Other item options: ([^\r\n]+)/)?.[1] ?? '', 'item')) result.push({ set: { ...set, item }, source });
    for (const alt of body.matchAll(/Move (\d) alternatives: ([^\r\n]+)/g)) {
      for (const move of refs(alt[2]!, 'move')) {
        const moves = [...set.moves]; moves[Number(alt[1]) - 1] = move;
        result.push({ set: { ...set, moves }, source });
      }
    }
    // The intrinsic ability pool is public; wiki recommendations are not evidence
    // that an unrevealed alternative is absent.
    for (const ability of Object.values(species.abilities) as string[]) result.push({ set: { ...set, ability }, source });
  }
  return result;
}

function unseenMon(preview: Mon, side: string, dex: any): Mon {
  const species = dex.species.get(short(preview.speciesId));
  return { id: preview.id, side, name: species.name, speciesId: preview.speciesId, slot: null, level: 50,
    gender: null, abilityId: null, item: { status: 'unknown' }, hp: { percent: null, exact: null },
    status: null, fainted: false, stats: null, statStages: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, accuracy: 0, evasion: 0 },
    knownMoveIds: [], movePP: {}, effects: [], lastItemLoss: null, lastMoveId: null, lastMoveTurn: null,
    enteredTurn: null, firstActionOpportunity: true, protectChain: 0, megaEvolved: false, simMoveAttempts: 0,
    // Never-entered participants start healthy. This is a declared synthetic
    // assumption, not an observed HP value; it never enters the canonical state.
    simObservedCondition: '100/100', movesComplete: false, initialSetDetails: null };
}

function nativeRevealedMoves(observation: SimObservation, mon: Mon) {
  const called = new Set<string>(), native = new Set<string>();
  for (const line of observation.log) {
    const [, event, ident = '', move = '', ...suffix] = line.split('|');
    if (event !== 'move' || ident.replace(/^p[12][ab]: /, '') !== mon.name || !ident.startsWith(mon.side)) continue;
    const value = id(move);
    (suffix.some(s => s.startsWith('[from]')) ? called : native).add(value);
  }
  return (mon.knownMoveIds as string[]).map(short).filter(move => move !== 'struggle' && move !== 'recharge' && (!called.has(move) || native.has(move)));
}

function conditionCandidates(observation: SimObservation, mon: Mon, knowledge: ConciseKnowledge, engine: any): Entry {
  const dex = engine.Dex.forFormat(formatId), current = dex.species.get(short(mon.speciesId));
  const initial = current.isMega ? dex.species.get(current.changesFrom || current.battleOnly || current.baseSpecies) : current;
  // Base-form templates already describe their stones and pre-Mega ability.
  const text = knowledge.wiki.pokemonSections?.[`pokemon:${initial.id}`]?.builds ?? knowledge.wiki.cards[`pokemon:${initial.id}`]?.text ?? '';
  const templates = wikiCandidates(text, initial, dex);
  const revealed = nativeRevealedMoves(observation, mon);
  const unique = new Map<string, Candidate>();
  let rejected = 0;
  for (const template of templates) {
    const set = structuredClone(template.set);
    set.name = mon.name; set.level = mon.level ?? 50;
    if (mon.gender) set.gender = mon.gender;
    // Preserve initial consumed items for team legality; current item state is
    // restored separately by the synthetic-state builder.
    if (mon.item.status === 'known') set.item = short(mon.item.cardId);
    else if (mon.lastItemLoss?.itemId) set.item = short(mon.lastItemLoss.itemId);
    if (mon.abilityId && !current.isMega) set.ability = short(mon.abilityId);
    if (current.isMega && mon.abilityId && !Object.values(current.abilities).some(v => id(v as string) === short(mon.abilityId))) { rejected++; continue; }
    for (const move of revealed) if (!set.moves.includes(move)) {
      let replace = -1;
      set.moves.forEach((candidate, index) => { if (!revealed.includes(candidate)) replace = index; });
      if (replace < 0) break;
      set.moves[replace] = move;
    }
    if (revealed.some(move => !set.moves.includes(move)) || new Set(set.moves).size !== 4) { rejected++; continue; }
    const errors = engine.TeamValidator.get(formatId).validateSet(structuredClone(set), {});
    if (errors?.length) { rejected++; continue; }
    const key = JSON.stringify({ ...set, item: id(set.item), ability: id(set.ability) });
    if (!unique.has(key)) unique.set(key, { id: `s${unique.size + 1}`, set,
      source: template.source, adjustedToReveals: JSON.stringify(set.moves) !== JSON.stringify(template.set.moves) ||
        id(set.item) !== id(template.set.item) || id(set.ability) !== id(template.set.ability) });
  }
  return { mon, candidates: [...unique.values()], rejected };
}

function combinations<T>(values: T[], count: number): T[][] {
  if (!count) return [[]];
  return values.flatMap((value, index) => combinations(values.slice(index + 1), count - 1).map(rest => [value, ...rest]));
}

/** Jev ranks plausible sets; deterministic code enforces revelations, team legality
 * and the shared simulation budget. The returned snapshots are analysis-only.
 */
export async function buildHiddenSetHypotheses(observation: SimObservation, knowledge: ConciseKnowledge,
  config: Config, v4Context: string, query: LiveQuery): Promise<HypothesisSet> {
  assert.equal(observation.audit.opponentInformation, 'revealed-only', 'Hidden-set inference requires the closed player observation.');
  assert.ok(!observation.log.some(line => line.startsWith('|showteam|') || line.startsWith('|jevselection|')), 'Opponent disclosure is forbidden.');
  const digestBefore = digest(JSON.stringify(observation));
  const unsupported = ((observation.audit.unsupportedTransitions ?? []) as string[]).filter(reason => !reason.startsWith('Closed opponent information:'));
  const output: HypothesisSet = { hypotheses: [], unsupported, coverage: 'At most six coherent set/roster worlds, each with one alternating low/high HP and timer endpoint; not exhaustive.',
    audit: { method: 'wiki-jev-hidden-sets-v1', source: 'Authorized player log, public species preview and pinned wiki builds only.',
      observationKey: observation.input.key, wikiHashes: knowledge.wiki.manifest.hashes,
      probabilityPolicy: 'Choice distributions rank templates within a species only; they are not calibrated set frequencies, joint world probabilities or win probabilities.' } };
  if (unsupported.length || !['move', 'replacement'].includes(observation.input.phase)) return output;
  const engine = await loadEngine(), dex = engine.Dex.forFormat(formatId);
  const ownSide = observation.request.side!.id, foeSide = ownSide === 'p1' ? 'p2' : 'p1';
  const observed = observation.input.state.pokemon as Mon[], known = observed.filter(mon => mon.side === foeSide);
  const preview = observation.input.state.opponentPreview as Mon[];
  assert.ok(preview?.length === 6 && known.length >= 2 && known.length <= 4, 'Public preview and observed participants are required.');
  const previewDetails = observation.log.filter(line => line.startsWith(`|poke|${foeSide}|`)).map(line => line.split('|')[3]!);
  const entries = preview.map((p, index) => {
    const mon = structuredClone(known.find(mon => mon.id === p.id) ?? unseenMon(p, foeSide, dex));
    if (mon.enteredTurn === null) {
      mon.gender = /(?:^|, )([MF])(?:,|$)/.exec(previewDetails[index] ?? '')?.[1] ?? null;
      mon.level = Number(/(?:^|, )L(\d+)/.exec(previewDetails[index] ?? '')?.[1] ?? 50);
    }
    return conditionCandidates(observation, mon, knowledge, engine);
  });
  output.audit.candidates = entries.map(entry => ({ actorId: entry.mon.id, rejected: entry.rejected, candidates: entry.candidates }));
  const impossibleKnown = entries.filter(entry => known.some(mon => mon.id === entry.mon.id) && !entry.candidates.length);
  if (impossibleKnown.length) {
    output.unsupported.push(`No legal wiki-based completion for observed participants: ${impossibleKnown.map(entry => entry.mon.name).join(', ')}.`); return output;
  }
  const rankable = entries.filter(entry => entry.candidates.length > 1 && !entry.mon.fainted &&
    (known.length < 4 || known.some(mon => mon.id === entry.mon.id)));
  const questions: SystemOneRequest['questions'] = Object.fromEntries(rankable.map((entry, i) => [`set${i}`, {
    type: 'choice' as const,
    instructions: `For opponent ${entry.mon.name} [${entry.mon.id}], select the most plausible complete hypothetical build given PUBLIC evidence and team composition. These are legal wiki-derived candidates, not known sets. Rank plausibility, not which build would be convenient to face. Unrevealed facts remain unknown.`,
    criteria: Object.fromEntries(entry.candidates.map(candidate => [candidate.id, JSON.stringify({ ...candidate.set, source: candidate.source, conditioned: candidate.adjustedToReveals })])),
  }]));
  if (rankable.length) {
    assert.ok(rankable.every(entry => entry.candidates.length <= Math.min(config.maxChoices, 255)), 'Set template menu exceeds the Choice limit; no candidates were silently removed.');
    let newestRequest = -1;
    observation.log.forEach((line, index) => { if (line.startsWith('|request|')) newestRequest = index; });
    const request: SystemOneRequest = { model: config.model, state: JSON.parse(JSON.stringify({
      method: 'wiki-jev-hidden-sets-v1', v4Context,
      showdownLog: observation.log.filter((line, index) => !line.startsWith('|request|') || index === newestRequest),
      policy: 'Only public opponent evidence. Unknown participants, sets and training remain assumptions. No actual opponent catalog assignment, selected four, commands, seed or snapshot is available.',
    })), questions };
    assertBudget(request, config);
    const raw = await query('hidden-set-ranking', request) as any;
    const rankings = [];
    for (const [i, entry] of rankable.entries()) {
      const answer = readChoice({ ...raw, answers: { selection: raw.answers?.[`set${i}`] } },
        entry.candidates.map(c => ({ id: c.id, command: '', description: '' })), config.model);
      entry.candidates.sort((a, b) => answer.probabilities[b.id]! - answer.probabilities[a.id]! || a.id.localeCompare(b.id));
      rankings.push({ actorId: entry.mon.id, ...answer });
    }
    output.audit.rankings = rankings;
  }
  const confirmed = entries.filter(entry => known.some(mon => mon.id === entry.mon.id));
  const possible = entries.filter(entry => !known.some(mon => mon.id === entry.mon.id) && entry.candidates.length);
  const rosters = combinations(possible, 4 - confirmed.length).map(rest => [...confirmed, ...rest]);
  output.audit.rosterCoverage = { possibleCombinations: combinations(preview.filter(p => !known.some(mon => mon.id === p.id)), 4 - known.length).length,
    withLegalTemplates: rosters.length, excludedUnseenWithoutTemplates: entries.filter(entry => !entry.candidates.length).map(entry => entry.mon.id) };
  const worlds: { entries: Entry[]; sets: Candidate[] }[] = [];
  const fingerprints = new Set<string>();
  let searched = 0, illegalTeams = 0;
  // One world per possible roster before additional set variants; all actions
  // see the same worlds. Round two starts from a different ranked template.
  for (let round = 0; round < 6 && worlds.length < 6; round++) for (const roster of rosters) {
    if (worlds.length >= 6) break;
    let attempts = 0;
    // Champions validates the full six. The other two complete the public
    // preview only for team legality; they are never synthetic reserves.
    const full = [...roster, ...entries.filter(entry => !roster.includes(entry))];
    const search = (index: number, chosen: Candidate[]): Candidate[] | null => {
      if (++attempts > 2000) return null;
      if (index === roster.length && fingerprints.has(JSON.stringify(roster.map((entry, i) => [entry.mon.id, chosen[i]!.id])))) return null;
      if (index === full.length) {
        searched++;
        const signature = JSON.stringify(roster.map((entry, i) => [entry.mon.id, chosen[i]!.id]));
        if (fingerprints.has(signature)) return null;
        if (engine.TeamValidator.get(formatId).validateTeam(chosen.map(c => structuredClone(c.set)))?.length) { illegalTeams++; return null; }
        fingerprints.add(signature); return chosen.slice(0, 4);
      }
      const candidates = full[index]!.candidates;
      for (let offset = 0; offset < candidates.length; offset++) {
        const candidate = candidates[(round + offset) % candidates.length]!;
        if (candidate.set.item && chosen.some(other => id(other.set.item) === id(candidate.set.item))) continue;
        const found = search(index + 1, [...chosen, candidate]);
        if (found) return found;
      }
      return null;
    };
    const selected = search(0, []);
    if (selected) worlds.push({ entries: roster, sets: selected });
  }
  const summaries = [], rejectedWorlds = [];
  for (const [index, world] of worlds.entries()) {
    const worldId = `world${index + 1}`;
    const synthetic = structuredClone(observation);
    synthetic.audit.unsupportedTransitions = [...unsupported];
    const hypothetical = world.entries.map((entry, i) => {
      const mon = structuredClone(entry.mon), set = world.sets[i]!.set;
      mon.initialSetDetails = { nature: set.nature, evs: set.evs };
      mon.knownMoveIds = set.moves.map(move => `move:${id(move)}`); mon.movesComplete = true;
      if (!mon.abilityId) mon.abilityId = `ability:${id(set.ability)}`;
      if (mon.item.status === 'unknown') mon.item = set.item ? { status: 'known', cardId: `item:${id(set.item)}` } : { status: 'none' };
      mon.fainted = mon.fainted === true;
      return mon;
    });
    synthetic.input.state.pokemon = [...observed.filter(mon => mon.side === ownSide).map(mon => structuredClone(mon)), ...hypothetical];
    const built = await buildSimHypotheses(synthetic, { unknownReserveHP: 'bounds', completedHiddenSets: true });
    if (built.unsupported.length || !built.hypotheses.length) {
      rejectedWorlds.push({ worldId, reasons: built.unsupported }); continue;
    }
    const selected = built.hypotheses[index % built.hypotheses.length]!;
    const actualPoints = built.audit[`inferredPoints_${index % 2 ? 'high' : 'low'}`] as Record<string, StatBlock>;
    selected.id = `${worldId}-${index % 2 ? 'high' : 'low'}`;
    selected.assumptions.unshift('Opponent moves, abilities, items, nature, training and unseen reserves in this branch are inferred possibilities, not revelations.',
      'Never-entered hypothetical reserves are assumed healthy; only four participants exist in this synthetic world.');
    selected.roster = (synthetic.input.state.pokemon as Mon[]).map(mon => ({ id: mon.id, name: mon.name,
      side: mon.side === ownSide ? 'own' as const : 'opponent' as const, initiallyFainted: mon.fainted === true }));
    output.hypotheses.push(selected);
    summaries.push({ hypothesisId: selected.id, participants: world.entries.map((entry, i) => ({
      actorId: entry.mon.id, name: entry.mon.name, confirmedParticipant: known.some(mon => mon.id === entry.mon.id),
      assumedSet: { ...world.sets[i]!.set, evs: actualPoints[entry.mon.id]! }, source: world.sets[i]!.source,
      currentSpecies: dex.species.get(short(entry.mon.speciesId)).name,
      currentAbility: entry.mon.abilityId ? short(entry.mon.abilityId) : world.sets[i]!.set.ability,
      conditioned: world.sets[i]!.adjustedToReveals || JSON.stringify(actualPoints[entry.mon.id]) !== JSON.stringify(world.sets[i]!.set.evs),
      currentItem: entry.mon.item.status === 'unknown' ? 'inferred' : entry.mon.item,
    })) });
  }
  output.audit.worldSearch = { searched, illegalTeams, constructed: worlds.length, retained: summaries.length, rejectedWorlds,
    policy: 'Up to 6 worlds, 2000 search nodes per roster/round. One per roster before alternatives; then cyclic template ranks. Single-slot wiki variants only; combinations outside this pool remain untested.' };
  output.audit.worlds = summaries;
  output.audit.representedRosters = new Set(summaries.map(world => world.participants.map(p => p.actorId).sort().join(','))).size;
  const setTable: Record<string, unknown> = {}, setKeys = new Map<string, string>();
  const compactWorlds = summaries.map(world => ({ id: world.hypothesisId, sets: world.participants.map(participant => {
    const set = participant.assumedSet;
    const value = { actor: participant.actorId, name: participant.name, species: participant.currentSpecies,
      ability: participant.currentAbility, item: participant.currentItem === 'inferred' ? set.item : participant.currentItem,
      nature: set.nature, moves: set.moves, points: stats.map(stat => set.evs[stat]), source: participant.source,
      ...(participant.conditioned ? { adaptedToReveals: true } : {}) };
    const signature = JSON.stringify(value);
    let key = setKeys.get(signature);
    if (!key) { key = `set${setKeys.size + 1}`; setKeys.set(signature, key); setTable[key] = value; }
    return key;
  }) }));
  output.inference = { method: 'wiki-jev-hidden-sets-v1', worlds: compactWorlds, sets: setTable,
    confirmedParticipants: known.map(mon => mon.id), pointOrder: stats,
    uncertainty: 'All sets and unconfirmed participants below are hypothetical. Public reveals override templates each turn. Choice scores are not world/win probabilities. Each own action faces this same bounded pool, with alternating HP/timer endpoints. Opponent commands are interpreted within their hypothesis, since move/switch slots may differ.',
    backingStats: 'Own current stats are exact. If nature is absent, a legal stat-compatible own backing nature/spread is used; future Mega stats can remain conditional. Hypothetical opponent HP points may be minimally adjusted to match the observed HP display. Unobserved PP are assumed full; HP/timers use sampled compatible endpoints. Full reconstruction assumptions remain in the audit.',
    rejectedWorldCount: rejectedWorlds.length, rosterCoverage: output.audit.rosterCoverage };
  if (!output.hypotheses.length) output.unsupported.push('No legal observation-compatible inferred world could be reconstructed.');
  assert.equal(digest(JSON.stringify(observation)), digestBefore, 'Inference mutated confirmed observation.');
  return output;
}
