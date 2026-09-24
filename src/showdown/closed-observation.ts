import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { BattleObserver } from './observer.js';
import { LogOnlyObserver } from './log-only.js';
import { formatId, loadEngine } from './engine.js';
import type { BattleRequest, RequestPokemon } from './actions.js';
import type { DecisionInput, PlainSet, PracticeTeams, StatBlock, TeamMember, TeamSheet } from './types.js';

type Side = 'p1' | 'p2';
const id = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
const zero = (): StatBlock => ({ hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 });
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const opposite = (side: Side): Side => side === 'p1' ? 'p2' : 'p1';
function swapText(value: string): string {
  if (value === 'p1' || value === 'p2') return opposite(value);
  return value.replace(/(^|\||\[of\] )(p[12])(?=(?:[ab])?: |\||$)/g,
    (_, prefix: string, side: Side) => `${prefix}${opposite(side)}`);
}
function swapValue(value: any): any {
  if (typeof value === 'string') return swapText(value);
  if (Array.isArray(value)) return value.map(swapValue);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .map(([key, child]) => [key === 'p1' || key === 'p2' ? opposite(key) : key, swapValue(child)]));
  return value;
}
const unsupportedEvents = new Set(['replace', 'swap', '-transform', '-swapboost', '-copyboost',
  '-swapsideconditions', '-primal', '-burst', '-terastallize', '-center', '-combine']);

/** No catalog, opponent set, selected-four disclosure or live engine object is accepted. */
export async function reconstructClosedObservation(log: readonly string[], options: {
  ourSide?: Side; battleId?: string;
} = {}): Promise<{ input: DecisionInput; audit: Record<string, unknown> }> {
  const publicObserver = new LogOnlyObserver(options);
  publicObserver.receive(log.join('\n'));
  const baseline = publicObserver.decision();
  assert.ok(baseline, 'Closed observation requires a current actionable own request.');
  const ourSide = baseline.requestIdentity!.ourSide as Side, theirSide = opposite(ourSide);
  assert.ok(!log.some(line => line.startsWith(`|showteam|${theirSide}|`) || line.startsWith('|jevselection|')),
    'Closed information policy forbids opponent sheets and selected-four disclosures.');
  for (const line of publicObserver.showdownLog) {
    const [, event = '', , effect = ''] = line.split('|');
    assert.ok(!unsupportedEvents.has(event), `Observation bridge does not reconstruct event ${event}.`);
    assert.ok(!((event === '-start' || event === '-end') && /^(?:typechange|typeadd|transform|illusion)$/i.test(effect)),
      `Observation bridge does not reconstruct effect ${effect}.`);
  }
  const requests = log.filter(line => line.startsWith('|request|')).map(line => JSON.parse(line.slice(9)) as BattleRequest | null)
    .filter(request => request?.side) as BattleRequest[];
  const initial = new Map<string, RequestPokemon>(), latest = new Map<string, RequestPokemon>(), maxHP = new Map<string, number>();
  for (const request of requests) for (const mon of request.side!.pokemon) {
    if (!initial.has(mon.ident)) initial.set(mon.ident, mon);
    latest.set(mon.ident, mon);
    const max = /^\d+\/(\d+)/.exec(mon.condition)?.[1];
    if (max) maxHP.set(mon.ident, Number(max));
  }
  const engine = await loadEngine(), dex = engine.Dex.forFormat(formatId);
  const previews = log.filter(line => line.startsWith(`|poke|${theirSide}|`)).map(line => line.split('|')[3]!);
  assert.equal(previews.length, 6, 'Closed observation requires the public preview of six opposing species.');
  const aliases = new Map<string, Set<string>>();
  for (const line of log) {
    const [, event, ident = '', details = ''] = line.split('|');
    if (!['switch', 'drag'].includes(event ?? '') || !ident.startsWith(theirSide)) continue;
    const species = dex.species.get(details.split(',')[0]!.trim());
    const base = id(species.baseSpecies);
    if (!aliases.has(base)) aliases.set(base, new Set());
    aliases.get(base)!.add(ident.replace(/^p[12][ab]: /, ''));
  }
  const makeSheet = (own: boolean): TeamSheet => {
    const entries = own ? [...initial.values()] : previews.map(details => ({ details }));
    const members = entries.map((entry, index): TeamMember => {
      const species = dex.species.get(entry.details.split(',')[0]!.trim());
      assert.ok(species.exists, 'Unknown publicly observed species.');
      const observedNames = [...(aliases.get(id(species.baseSpecies)) ?? [])];
      if (!own) assert.ok(observedNames.length <= 1, 'Ambiguous public species identity.');
      const ownEntry = own ? entry as RequestPokemon : undefined;
      const name = ownEntry ? ownEntry.ident.replace(/^p[12]: /, '') : observedNames[0] ?? species.name;
      const set: PlainSet = { name, species: species.name, level: Number(/(?:^|, )L(\d+)/.exec(entry.details)?.[1] ?? 50),
        gender: /(?:^|, )([MF])(?:,|$)/.exec(entry.details)?.[1],
        ability: ownEntry ? dex.abilities.get(ownEntry.ability ?? ownEntry.baseAbility ?? '').name : '',
        item: ownEntry?.item ? dex.items.get(ownEntry.item).name : '', nature: '',
        moves: ownEntry?.moves?.map(move => dex.moves.get(move).name) ?? [], evs: zero() };
      // These scaffolding zeros and blank sets are never exported as known facts.
      const member: TeamMember = { id: `${own ? 'own' : 'foe'}-${index + 1}`, speciesId: `pokemon:${species.id}`,
        name, set, types: [...species.types], stats: zero() };
      if (ownEntry) {
        const current = latest.get(ownEntry.ident)!;
        assert.ok(current.stats && maxHP.has(ownEntry.ident), 'Missing authorized own statistics.');
        member.stats = { hp: maxHP.get(ownEntry.ident)!, ...current.stats } as StatBlock;
        const item = dex.items.get(set.item);
        const megaName = typeof item.megaStone === 'string' ? item.megaStone : item.megaStone?.[species.name];
        if (megaName) {
          const mega = dex.species.get(megaName);
          member.mega = { speciesId: `pokemon:${mega.id}`, types: [...mega.types],
            abilityId: `ability:${id(mega.abilities['0'])}`, stats: zero() };
        }
      }
      return member;
    });
    assert.equal(new Set(members.map(mon => id(mon.name))).size, members.length, 'Ambiguous public nickname.');
    return { label: own ? 'Own request' : 'Public species preview', sourceUrl: 'authorized player protocol',
      sets: members.map(mon => mon.set), packed: '', members };
  };
  const teams: PracticeTeams = { human: makeSheet(false), jev: makeSheet(true) };
  const observer = new BattleObserver(teams, { battleId: options.battleId, informationPolicy: 'observed-only', inferParticipantsFromEntries: true });
  observer.receive(log.map(line => ourSide === 'p2' ? line : line.startsWith('|request|')
    ? `|request|${JSON.stringify(swapValue(JSON.parse(line.slice(9))))}` : swapText(line)).join('\n'));
  const replay = observer.decision();
  assert.ok(replay, 'Closed observation could not reconstruct the own decision.');
  assert.deepEqual(replay.candidates.map(action => action.command).sort(), baseline.candidates.map(action => action.command).sort(),
    'Closed observation and native menu disagree.');
  const state = (ourSide === 'p1' ? swapValue(replay.state) : structuredClone(replay.state)) as Record<string, any>;
  const required = new Set(replay.requiredCardIds), names = state.entityNames as Record<string, string>;
  for (const mon of state.pokemon as Record<string, any>[]) {
    const own = mon.side === ourSide;
    mon.initialSetDetails = null; // Nature/training are not in player requests or public events.
    mon.movesComplete = own; // Observed called/copied moves do not prove a complete original moveset.
    mon.provenance = { set: own ? 'own-private-request' : 'public-reveals-only', dynamics: 'player-protocol' };
    if (own) {
      const entry = latest.get(`${ourSide}: ${mon.name}`)!;
      mon.stats = { hp: maxHP.get(entry.ident)!, ...entry.stats };
    } else {
      mon.stats = null; mon.hp.exact = null;
      if (mon.enteredTurn === null && mon.fainted !== true) mon.fainted = null;
    }
    if (mon.availableMegaForm) {
      mon.availableMegaForm.unmodifiedStats = null;
      mon.availableMegaForm.provenance = 'Own disclosed item and public species metadata; trained Mega stats unknown.';
    }
    const species = dex.species.get(mon.speciesId.slice(8));
    mon.typeIds = species.types.map((type: string) => `type:${id(type)}`);
    names[mon.speciesId] = species.name; required.add(mon.speciesId);
    for (const type of mon.typeIds) required.add(type);
    for (const move of mon.knownMoveIds) if (move !== 'move:recharge') {
      required.add(move); names[move] = dex.moves.get(move.slice(5)).name;
    }
  }
  state.informationPolicy = { mode: 'observed-only',
    sets: 'Own current request is private to Jev. Opponent moves, items and abilities are unknown until publicly revealed. Opponent nature and trained stats are unknown. Species metadata is public mechanics, not a known set.',
    opponentSelection: 'Six species are public at preview. The selected four and lead order are hidden. Public entries or faints establish participants; unseen preview members are possibilities, not confirmed reserves.',
    opponentPendingCommands: 'hidden' };
  const input: DecisionInput = { phase: baseline.phase, state, requiredCardIds: [...required].sort(),
    candidates: structuredClone(baseline.candidates), requestIdentity: baseline.requestIdentity,
    key: hash({ state, candidates: baseline.candidates }) };
  return { input, audit: { source: 'Authorized own requests, public events and public species metadata only; no catalog or opponent disclosure.',
    opponentInformation: 'revealed-only', selectedFourPolicy: 'hidden', exactOriginalCandidates: true,
    unsupportedTransitions: ['Closed opponent information: the current simulator cannot model unknown sets, nature and unobserved participants. Simulation is unavailable; no private team data is substituted.'],
    observationDigest: hash(state) } };
}
