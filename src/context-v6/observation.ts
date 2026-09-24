import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { BattleObserver } from '../showdown/observer.js';
import { LogOnlyObserver } from '../showdown/log-only.js';
import { formatId, loadEngine } from '../showdown/engine.js';
import type { BattleRequest, RequestPokemon } from '../showdown/actions.js';
import type { DecisionInput, PlainSet, PracticeTeams, StatBlock, TeamMember, TeamSheet } from '../showdown/types.js';

type Side = 'p1' | 'p2';
type PublicSet = Omit<PlainSet, 'evs'>;
type RecordValue = Record<string, any>;
/** Separate authorized disclosure; never manufacture a public entry in the log. */
export type DisclosedOpponentSelection = {
  kind: 'confirmed-unordered-selection'; battleId: string; side: Side; names: string[];
};
const statsKeys = ['atk', 'def', 'spa', 'spd', 'spe'] as const;
const placeholderStats = (): StatBlock => ({ hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 });
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const opposite = (side: Side): Side => side === 'p1' ? 'p2' : 'p1';
const idOf = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

// Remap protocol side tokens, not arbitrary substrings in nicknames or prose.
function swapText(value: string): string {
  if (value === 'p1' || value === 'p2') return opposite(value);
  return value.replace(/(^|\||\[of\] )(p[12])(?=(?:[ab])?: |\||$)/g,
    (_, prefix: string, side: Side) => `${prefix}${opposite(side)}`);
}
function swapValue(value: unknown): unknown {
  if (typeof value === 'string') return swapText(value);
  if (Array.isArray(value)) return value.map(swapValue);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .map(([key, child]) => [key === 'p1' || key === 'p2' ? opposite(key) : key, swapValue(child)]));
  return value;
}
function swapLine(line: string): string {
  return line.startsWith('|request|')
    ? `|request|${JSON.stringify(swapValue(JSON.parse(line.slice(9))))}` : swapText(line);
}

// The production observer does not reconstruct these mutations. Preserve the
// source log, but refuse a generated-state experiment rather than assert stale
// types, identities, boosts, slot positions, or move sets as current facts.
const unsupportedEvents = new Set(['replace', 'swap', '-transform', '-swapboost', '-copyboost',
  '-swapsideconditions', '-primal', '-burst', '-terastallize', '-center', '-combine']);

/**
 * Reconstruct the shared context-builder input exclusively from an authorized
 * player log and public pinned Dex metadata. No fixture generator, answer key,
 * battle object, opponent request, training spread, or pending command is read.
 *
 * Currently requires a full initial Open Team Sheet for each side, a current
 * own four-member request, and public evidence of all four opposing entrants.
 * Logs lacking those facts fail explicitly; unobserved reserves are not filled
 * from the first four OTS entries. The ordinary log-only baseline remains usable.
 */
export async function reconstructV6BenchmarkObservation(showdownLog: readonly string[], options: {
  ourSide?: Side; battleId?: string; disclosedOpponentSelection?: DisclosedOpponentSelection;
} = {}): Promise<{ input: DecisionInput; audit: Record<string, unknown> }> {
  const publicObserver = new LogOnlyObserver(options);
  publicObserver.receive(showdownLog.join('\n'));
  const baseline = publicObserver.decision();
  assert.ok(baseline, 'Observation bridge requires a current actionable own request.');
  if (!options.disclosedOpponentSelection) assert.notEqual(baseline.phase, 'team-preview', 'Observation bridge requires confirmed participating teams, not Team Preview.');
  const log = publicObserver.showdownLog;
  const ourSide = baseline.requestIdentity!.ourSide as Side;
  const theirSide = opposite(ourSide);
  const battleId = options.battleId ?? 'benchmark-observation';
  const disclosure = options.disclosedOpponentSelection;
  if (disclosure) {
    assert.equal(disclosure.kind, 'confirmed-unordered-selection');
    assert.equal(disclosure.battleId, battleId, 'Selection disclosure belongs to another battle.');
    assert.equal(disclosure.side, theirSide, 'Selection disclosure must identify the opponent.');
    assert.ok(Array.isArray(disclosure.names) && disclosure.names.length === 4 &&
      disclosure.names.every(name => typeof name === 'string' && name.trim()) && new Set(disclosure.names.map(idOf)).size === 4,
    'Selection disclosure requires exactly four distinct public names.');
  }
  for (const line of log) {
    const [, event = '', , effect = ''] = line.split('|');
    assert.ok(!unsupportedEvents.has(event), `Observation bridge does not reconstruct event ${event}.`);
    assert.ok(!((event === '-start' || event === '-end') && /^(?:typechange|typeadd|transform|illusion)$/i.test(effect)),
      `Observation bridge does not reconstruct effect ${effect}.`);
  }
  const requests = log.filter(line => line.startsWith('|request|'))
    .map(line => JSON.parse(line.slice(9)) as BattleRequest | null).filter(request => request?.side) as BattleRequest[];
  assert.ok(requests.length, 'No own request found.');
  const current = publicObserver.ownRequest!;
  assert.equal(current.side!.pokemon.length, baseline.phase === 'team-preview' ? 6 : 4,
    'The own request must identify six preview members or exactly four participants.');
  const ownEntries = new Map<string, RequestPokemon>();
  const ownMaxHP = new Map<string, number>();
  for (const request of requests) for (const entry of request.side!.pokemon) {
    ownEntries.set(entry.ident, entry);
    const max = /^\d+\/(\d+)/.exec(entry.condition)?.[1];
    if (max) ownMaxHP.set(entry.ident, Number(max));
  }

  const engine = await loadEngine();
  const dex = engine.Dex.forFormat(formatId);
  // OTS may use the default form name (Raichu-Alola) while the player protocol
  // displays its default battle name (Raichu). Bind only a uniquely disclosed
  // species identity, never an invented nickname or an inferred hidden member.
  const identityEvidence = new Map<Side, Map<string, Set<string>>>();
  for (const side of ['p1', 'p2'] as const) identityEvidence.set(side, new Map());
  const rememberIdentity = (ident: string, details: string) => {
    const match = /^(p[12])(?:[ab])?: (.+)$/.exec(ident);
    const species = dex.species.get(details.split(',')[0]!.trim());
    if (!match || !species.exists) return;
    const names = identityEvidence.get(match[1] as Side)!;
    if (!names.has(match[2]!)) names.set(match[2]!, new Set());
    names.get(match[2]!)!.add(species.id);
  };
  for (const request of requests) for (const entry of request.side!.pokemon) rememberIdentity(entry.ident, entry.details);
  for (const line of log) {
    const [, event, ident, details] = line.split('|');
    if ((event === 'switch' || event === 'drag') && ident && details) rememberIdentity(ident, details);
  }
  const identityAliases: { side: Side; otsName: string; observedName: string; species: string }[] = [];
  const sheets: Partial<PracticeTeams> = {};
  const sourceSets = new Map<string, PublicSet>();
  for (const side of [ourSide, theirSide]) {
    const disclosures = log.filter(line => line.startsWith(`|showteam|${side}|`));
    assert.equal(disclosures.length, 1, 'Exactly one initial public Open Team Sheet per side is required.');
    const packed = disclosures[0]!.split('|').slice(3).join('|');
    const rawSets = engine.Teams.unpack(packed) as PublicSet[] | null;
    assert.ok(rawSets && rawSets.length === 6, 'Each public Open Team Sheet must identify six Pokemon.');
    const own = side === ourSide;
    const sets: PlainSet[] = rawSets.map(raw => {
      assert.ok(raw.species && raw.ability && raw.moves?.length && raw.nature,
        'A complete public set must disclose species, ability, moves and nature.');
      const otsName = raw.name || raw.species;
      let name = otsName;
      const names = identityEvidence.get(side)!;
      if (!names.has(name) && idOf(otsName) === idOf(raw.species)) {
        const species = dex.species.get(raw.species);
        const candidates = [...names].filter(([, speciesIds]) => speciesIds.has(species.id)).map(([observedName]) => observedName);
        if (candidates.length) {
          assert.equal(candidates.length, 1, `Ambiguous disclosed identity for ${otsName}.`);
          assert.equal(rawSets.filter(set => dex.species.get(set.species).id === species.id).length, 1,
            `Ambiguous public OTS species for ${otsName}.`);
          name = candidates[0]!;
          identityAliases.push({ side, otsName, observedName: name, species: species.id });
        }
      }
      return { name, species: raw.species,
        ability: dex.abilities.get(raw.ability).name, item: raw.item ? dex.items.get(raw.item).name : '',
        nature: raw.nature, moves: raw.moves.map(move => dex.moves.get(move).name),
        level: raw.level ?? 50, ...(raw.gender ? { gender: raw.gender } : {}),
        // Constructor scaffolding only: never exported as known training.
        evs: placeholderStats() };
    });
    assert.equal(new Set(sets.map(set => idOf(set.name))).size, 6, 'Ambiguous repeated OTS nickname.');
    const members: TeamMember[] = sets.map((set, index) => {
      const species = dex.species.get(set.species);
      assert.ok(species.exists, `Unknown public species ${set.species}.`);
      const id = `${own ? 'own' : 'foe'}-${index + 1}`;
      sourceSets.set(id, rawSets[index]!);
      const stats = placeholderStats();
      if (own) {
        const entry = ownEntries.get(`${side}: ${set.name}`);
        assert.ok(entry?.stats, `Own statistics for ${set.name} are not disclosed by the log.`);
        const max = ownMaxHP.get(entry.ident);
        assert.ok(max, `Own maximum HP for ${set.name} is not disclosed by the log.`);
        stats.hp = max;
        for (const stat of statsKeys) {
          assert.equal(typeof entry.stats[stat], 'number', `Missing own ${stat} for ${set.name}.`);
          stats[stat] = entry.stats[stat]!;
        }
      }
      const member: TeamMember = { id, speciesId: `pokemon:${species.id}`, name: set.name,
        types: [...species.types], stats, set };
      const item = dex.items.get(set.item);
      const megaName = typeof item.megaStone === 'string' ? item.megaStone : item.megaStone?.[species.name];
      if (megaName) {
        const mega = dex.species.get(megaName);
        member.mega = { speciesId: `pokemon:${mega.id}`, types: [...mega.types],
          abilityId: `ability:${idOf(mega.abilities['0'])}`, stats: placeholderStats() };
      }
      return member;
    });
    const sheet: TeamSheet = { label: 'Public Open Team Sheet', sourceUrl: 'player-visible |showteam|', sets, packed, members };
    sheets[own ? 'jev' : 'human'] = sheet;
  }
  const teams = sheets as PracticeTeams;
  const opponentNames = [...new Set(log.flatMap(line => {
    const [, event, ident = ''] = line.split('|');
    if (!['switch', 'drag', 'faint'].includes(event ?? '')) return [];
    const match = /^(p[12])(?:[ab])?: (.+)$/.exec(ident);
    return match?.[1] === theirSide ? [match[2]!] : [];
  }))];
  if (!disclosure) assert.equal(opponentNames.length, 4,
    'All four opposing participants must be established by public switch/drag/faint events; unobserved reserves remain unknown.');
  const opponentIds = (disclosure ? [...disclosure.names].sort() : opponentNames).map(name => {
    const matches = teams.human.members.filter(candidate => idOf(candidate.name) === idOf(name)
      || (disclosure && idOf(candidate.set.species) === idOf(name)));
    assert.equal(matches.length, 1, `Disclosed opposing identity ${name} must match exactly one public Open Team Sheet member.`);
    const member = matches[0];
    assert.ok(member, `Observed opposing identity ${name} is absent from its Open Team Sheet.`);
    return member.id;
  });
  if (disclosure) {
    assert.equal(new Set(opponentIds).size, 4, 'Selection disclosure aliases identify repeated Pokemon.');
    assert.ok(opponentNames.every(name => teams.human.members.some(member => opponentIds.includes(member.id)
      && idOf(member.name) === idOf(name))), 'Public opponent entry contradicts the confirmed selection.');
  }
  // Seed initial disclosed facts BEFORE replay so item consumption, changed
  // abilities, and Mega evolution cannot be overwritten by their initial sets.
  const observer = new BattleObserver(teams, { battleId, informationPolicy: 'revealed-demo' });
  observer.setOpponentSelection(opponentIds);
  observer.receive(log.map(line => ourSide === 'p1' ? swapLine(line) : line).join('\n'));
  const replay = observer.decision();
  assert.ok(replay, 'Production observer could not reconstruct this actionable decision.');
  assert.deepEqual(replay.candidates.map(action => action.command).sort(), baseline.candidates.map(action => action.command).sort(),
    'Production observer and log-only adapter disagree on the available commands.');
  const state = (ourSide === 'p1' ? swapValue(replay.state) : structuredClone(replay.state)) as RecordValue;
  const pokemon = state.pokemon as RecordValue[];
  const names = state.entityNames as Record<string, string>;
  const required = new Set(replay.requiredCardIds);
  for (const member of pokemon) {
    const initial = sourceSets.get(member.id)!;
    const own = member.side === ourSide;
    member.initialSetDetails = { nature: initial.nature, gender: initial.gender ?? null };
    member.movesComplete = own || member.knownMoveIds.every((id: string) => initial.moves.some(move => `move:${idOf(move)}` === id));
    member.provenance = { set: own ? 'own-request-and-public-open-team-sheet' : 'public-open-team-sheet', dynamics: 'player-protocol' };
    if (!own) { member.stats = null; member.hp.exact = null; }
    if (member.availableMegaForm) {
      member.availableMegaForm.unmodifiedStats = null;
      member.availableMegaForm.provenance = 'Public stone and species identify the Mega form; trained Mega stats are unknown.';
    }
    // Own current stats come ONLY from the last authorized own request. In
    // particular, the observer's internal Mega placeholder is never exported.
    if (own) {
      const entry = ownEntries.get(`${ourSide}: ${member.name}`)!;
      member.stats = { hp: ownMaxHP.get(entry.ident)!, ...Object.fromEntries(statsKeys.map(stat => [stat, entry.stats![stat]])) };
    }
    const species = dex.species.get(member.speciesId.slice('pokemon:'.length));
    assert.ok(species.exists, `Unknown current public form ${member.speciesId}.`);
    member.typeIds = species.types.map((type: string) => `type:${idOf(type)}`);
    required.add(member.speciesId); names[member.speciesId] = species.name;
    for (const id of member.typeIds) required.add(id);
    if (member.abilityId) required.add(member.abilityId);
    if (member.item.status === 'known') required.add(member.item.cardId);
    for (const id of member.knownMoveIds) {
      if (id !== 'move:recharge') { required.add(id); names[id] = dex.moves.get(id.slice(5)).name; }
    }
  }
  state.informationPolicy = { mode: 'observed-only',
    sets: 'Own requests disclose exact own stats. Public Open Team Sheets disclose initial moves, ability, item, nature and gender. Public events update those facts. Opposing trained stats and all training points remain unknown.',
    opponentSelection: 'All four identities are established by public entry/faint events in this log, not disclosed earlier as a selection or lead order.',
    opponentPendingCommands: 'hidden' };
  if (disclosure) {
    state.selectionDisclosure = { kind: disclosure.kind, side: theirSide,
      names: opponentIds.map(id => teams.human.members.find(member => member.id === id)!.name).sort(),
      provenance: 'The human confirmed these four identities under the explicit local match policy. Order and leads were not disclosed; this is not a public entry event.' };
    (state.informationPolicy as RecordValue).opponentSelection = 'Four identities explicitly disclosed after human confirmation as an unordered set; entries, order and leads come only from the player protocol.';
  }
  const input: DecisionInput = { phase: baseline.phase, state, requiredCardIds: [...required].sort(),
    candidates: structuredClone(baseline.candidates), requestIdentity: baseline.requestIdentity,
    key: digest({ state, candidates: baseline.candidates }) };
  return { input, audit: { schemaVersion: 1, source: 'authorized player log only plus pinned public Dex metadata',
    ...(identityAliases.length ? { identityAliases, identityPolicy: 'A default OTS species-form name may bind to exactly one identity with the same species disclosed by an authorized own request or public entry. Explicit nicknames are never replaced; ambiguous species identities fail.' } : {}),
    ourSide, observerReplaySide: 'p2', originalPlayerSidesRestored: true,
    publicLogDigest: digest(log), observationDigest: digest(state), originalCandidateDigest: digest(baseline.candidates),
    candidateCount: input.candidates.length, exactOriginalCandidates: true,
    opponentParticipantEvidence: opponentNames, participantIds: pokemon.map(member => member.id),
    ownStatsSource: 'Only authorized own private requests; historical own maximum HP retained for fainted members.',
    publicSetSource: 'Public |showteam| decoded by pinned Teams.unpack and loaded before event replay.',
    removedFields: ['Initial training points', 'Opposing trained stats', 'Unobserved trained Mega stats'],
    limitations: ['Requires six-member OTS and four publicly evidenced opposing participants.',
      'Unsupported identity, copied-state, typing and slot mutations fail explicitly.',
      'Public HP remains a displayed percentage; it is never converted to exact opponent HP.'] } };
}
