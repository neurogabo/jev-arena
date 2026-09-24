import { createHash } from 'node:crypto';
import { buildPreviewActions, buildTurnActions } from './actions.js';
import type { BattleRequest, RequestPokemon } from './actions.js';
import type { DecisionInput, PracticeTeams, StatBlock, TeamMember } from './types.js';

const toID = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
const zeroBoosts = () => ({ atk: 0, def: 0, spa: 0, spd: 0, spe: 0, accuracy: 0, evasion: 0 });
// Wide/Quick Guard do not roll for successive-use failure, but successful uses
// add/restart the same stall counter as Protect in the pinned Champions engine.
const protectionMoves = new Set(['protect', 'detect', 'spikyshield', 'kingsshield', 'banefulbunker', 'silktrap', 'burningbulwark', 'endure', 'wideguard', 'quickguard']);
type Side = 'p1' | 'p2';
type Effect = { name: string; sinceTurn: number; remainingTurns: null };
type MovePP = {
  current: number | null; max: number | null;
  source: 'current-request' | 'unconfirmed-since-request';
  lastObserved: { current: number; turn: number };
};
type SeenPokemon = {
  id: string; side: Side; name: string; speciesId: string; typeIds: string[]; slot: number | null;
  level: number; gender: string | null; abilityId: string | null; item: { status: 'known'; cardId: string } | { status: 'none' | 'unknown' };
  hp: { percent: number | null; exact: { current: number; max: number } | null };
  status: string | null; fainted: boolean; stats: StatBlock | null;
  statStages: ReturnType<typeof zeroBoosts>; knownMoveIds: string[];
  movePP: Record<string, MovePP>; effects: Effect[];
  lastItemLoss: { itemId: string; turn: number; consumed: boolean | null } | null;
  lastMoveId: string | null; lastMoveTurn: number | null; enteredTurn: number | null;
  firstActionOpportunity: boolean; protectChain: number; megaEvolved: boolean;
  provenance: { set: 'own-team' | 'disclosed-initial-set' | 'unrevealed'; dynamics: 'player-protocol' };
};
type MoveEvent = { turn: number; actorId: string; moveId: string; targetId: string | null };
export type ObserverOptions = { battleId?: string; ourSide?: 'p2'; informationPolicy?: 'revealed-demo' | 'observed-only'; inferParticipantsFromEntries?: boolean };

/** Only pass the p2 player stream, never omniscient BattleStream updates or engine objects. */
export class BattleObserver {
  private readonly teams: PracticeTeams;
  private readonly battleId: string;
  private readonly informationPolicy: 'revealed-demo' | 'observed-only';
  private readonly inferParticipantsFromEntries: boolean;
  private readonly pokemon = new Map<string, SeenPokemon>();
  private readonly members = new Map<string, TeamMember>();
  private readonly entityNames = new Map<string, string>();
  private request: BattleRequest | null = null;
  private opponentSelection: string[] | null = null;
  private ownSelection: string[] | null = null;
  private field: Effect[] = [];
  private sideConditions: Record<Side, Effect[]> = { p1: [], p2: [] };
  private moveHistory: MoveEvent[] = [];
  private publicEvents: string[] = [];
  private currentTurn = 0;
  private isEnded = false;
  private winner: string | null = null;
  private revision = 0;
  private rejectedCommands: string[] = [];
  private protectionSucceeded = new Map<string, number>();

  constructor(teams: PracticeTeams, options: ObserverOptions = {}) {
    this.teams = teams;
    this.battleId = options.battleId ?? 'local-practice';
    this.informationPolicy = options.informationPolicy ?? 'revealed-demo';
    this.inferParticipantsFromEntries = options.inferParticipantsFromEntries ?? false;
    for (const side of ['p1', 'p2'] as const) {
      const sheet = side === 'p1' ? teams.human : teams.jev;
      for (const member of sheet.members) {
        if (this.members.has(member.id)) throw new Error(`Duplicate team identity: ${member.id}.`);
        this.members.set(member.id, member);
        this.entityNames.set(member.speciesId, member.set.species);
        if (member.mega) {
          const variant = /mega([xy])$/.exec(member.mega.speciesId)?.[1]?.toUpperCase();
          this.entityNames.set(member.mega.speciesId, `${member.set.species} (Mega${variant ? ` ${variant}` : ''})`);
        }
        this.rememberName('ability', member.set.ability);
        if (member.set.item) this.rememberName('item', member.set.item);
        for (const move of member.set.moves) this.rememberName('move', move);
        const disclosed = side === 'p2' || this.informationPolicy === 'revealed-demo';
        this.pokemon.set(member.id, {
          id: member.id, side, name: member.name, speciesId: member.speciesId,
          typeIds: member.types.map(type => type.startsWith('type:') ? type : `type:${toID(type)}`), slot: null,
          level: member.set.level, gender: disclosed ? member.set.gender ?? null : null,
          abilityId: disclosed ? `ability:${toID(member.set.ability)}` : null,
          item: disclosed ? member.set.item ? { status: 'known', cardId: `item:${toID(member.set.item)}` } : { status: 'none' } : { status: 'unknown' },
          hp: { percent: null, exact: null }, status: null, fainted: false,
          stats: disclosed ? { ...member.stats } : null, statStages: zeroBoosts(),
          knownMoveIds: disclosed ? member.set.moves.map(move => `move:${toID(move)}`) : [], movePP: {}, effects: [], lastItemLoss: null,
          lastMoveId: null, lastMoveTurn: null, enteredTurn: null, firstActionOpportunity: true, protectChain: 0,
          megaEvolved: false, provenance: { set: side === 'p2' ? 'own-team' : disclosed ? 'disclosed-initial-set' : 'unrevealed', dynamics: 'player-protocol' },
        });
      }
    }
  }

  get ownRequest(): BattleRequest | null { return this.request ? structuredClone(this.request) : null; }
  get turn(): number { return this.currentTurn; }
  get ended(): boolean { return this.isEnded; }

  private rememberName(kind: string, name: string): string {
    const id = `${kind}:${toID(name)}`;
    // A request may use a normalized ID where public protocol uses the readable name.
    if (!this.entityNames.has(id) || name !== toID(name)) this.entityNames.set(id, name);
    return id;
  }

  private invalidatePP(): void {
    // Replacement requests do not disclose PP. Do not guess the cost of a move:
    // Pressure, called moves and PP-changing effects can change it.
    for (const pokemon of this.pokemon.values()) if (pokemon.side === 'p2') {
      for (const pp of Object.values(pokemon.movePP)) {
        pp.current = null; pp.source = 'unconfirmed-since-request';
      }
    }
  }

  setOpponentSelection(ids: string[]): void {
    const allowed = new Set(this.teams.human.members.map(member => member.id));
    if (ids.length !== 4 || new Set(ids).size !== 4 || ids.some(id => !allowed.has(id))) {
      throw new Error('The disclosed opponent selection must contain four distinct human team IDs.');
    }
    const canonical = [...ids].sort();
    if (JSON.stringify(canonical) !== JSON.stringify(this.opponentSelection)) this.revision++;
    this.opponentSelection = canonical;
  }

  /** Rejected commands remain excluded until a new request arrives; public rejection text is separately observed. */
  rejectCommand(command: string): void {
    if (!this.rejectedCommands.includes(command)) { this.rejectedCommands.push(command); this.revision++; }
  }

  private identify(ident: string, details?: string): SeenPokemon | undefined {
    const match = /^(p[12])([ab])?:\s*(.+)$/.exec(ident);
    if (!match) return undefined;
    const side = match[1] as Side;
    const name = toID(match[3]!);
    const choices = [...this.pokemon.values()].filter(pokemon => pokemon.side === side);
    const named = choices.find(pokemon => toID(pokemon.name) === name || toID(this.members.get(pokemon.id)!.set.name) === name);
    if (named) return named;
    const species = details?.split(',')[0]?.trim();
    if (species) {
      const speciesId = `pokemon:${toID(species)}`;
      const found = choices.find(pokemon => pokemon.speciesId === speciesId || this.members.get(pokemon.id)!.speciesId === speciesId);
      if (found) return found;
    }
    const slot = match[2] ? match[2].charCodeAt(0) - 97 : null;
    return slot === null ? undefined : choices.find(pokemon => pokemon.slot === slot);
  }

  private condition(pokemon: SeenPokemon, condition: string): void {
    const hp = /^(\d+)(?:\/(\d+))?(?:\s+(\w+))?/.exec(condition);
    if (!hp) return;
    const current = Number(hp[1]);
    const max = hp[2] ? Number(hp[2]) : null;
    pokemon.fainted = condition.includes('fnt') || current === 0;
    pokemon.hp = {
      percent: pokemon.fainted ? 0 : max ? current / max * 100 : null,
      exact: pokemon.side === 'p2' && max ? { current, max } : null,
    };
    pokemon.status = hp[3] && hp[3] !== 'fnt' ? hp[3] : null;
  }

  private setForm(pokemon: SeenPokemon, details: string): void {
    const species = details.split(',')[0]!.trim();
    if (!species) return;
    pokemon.speciesId = `pokemon:${toID(species)}`;
    if (species !== toID(species)) this.entityNames.set(pokemon.speciesId, species);
    const level = /(?:^|, )L(\d+)/.exec(details);
    if (level) pokemon.level = Number(level[1]);
    const gender = /(?:^|, )([MF])(?:,|$)/.exec(details);
    if (gender) pokemon.gender = gender[1]!;
    const member = this.members.get(pokemon.id)!;
    if (member.mega?.speciesId === pokemon.speciesId) {
      pokemon.typeIds = member.mega.types.map(type => type.startsWith('type:') ? type : `type:${toID(type)}`);
      pokemon.abilityId = member.mega.abilityId;
      if (pokemon.stats) pokemon.stats = { ...member.mega.stats };
      pokemon.megaEvolved = true;
    } else if (member.speciesId === pokemon.speciesId) {
      pokemon.typeIds = member.types.map(type => type.startsWith('type:') ? type : `type:${toID(type)}`);
    }
  }

  private ingestOwnRequest(request: BattleRequest): void {
    if (request.side && request.side.id !== 'p2') throw new Error('Refusing another player\'s private request.');
    this.request = request;
    this.rejectedCommands = [];
    this.invalidatePP();
    const roster = request.side?.pokemon;
    if (!roster) return;
    for (const pokemon of this.pokemon.values()) if (pokemon.side === 'p2') pokemon.slot = null;
    const selected: string[] = [];
    roster.forEach((entry, index) => {
      const pokemon = this.identify(entry.ident, entry.details);
      if (!pokemon) throw new Error(`Unknown own Pokémon in request: ${entry.ident}.`);
      selected.push(pokemon.id);
      if (!request.teamPreview) pokemon.slot = entry.active ? index : null;
      this.setForm(pokemon, entry.details);
      this.condition(pokemon, entry.condition);
      if (entry.ability || entry.baseAbility) pokemon.abilityId = `ability:${toID(entry.ability ?? entry.baseAbility!)}`;
      if (entry.item !== undefined) pokemon.item = entry.item ? { status: 'known', cardId: `item:${toID(entry.item)}` } : { status: 'none' };
      if (entry.moves) pokemon.knownMoveIds = entry.moves.map(move => `move:${toID(move)}`);
      if (entry.stats && pokemon.stats) {
        for (const stat of ['atk', 'def', 'spa', 'spd', 'spe'] as const) if (entry.stats[stat] !== undefined) pokemon.stats[stat] = entry.stats[stat]!;
        if (pokemon.hp.exact) pokemon.stats.hp = pokemon.hp.exact.max;
      }
      for (const move of request.active?.[index]?.moves ?? []) if (move.pp !== undefined) {
        this.rememberName('move', move.move);
        pokemon.movePP[`move:${toID(move.id)}`] = {
          current: move.pp, max: move.maxpp ?? null, source: 'current-request',
          lastObserved: { current: move.pp, turn: this.currentTurn },
        };
      }
    });
    if (!request.teamPreview && selected.length === 4) this.ownSelection = [...selected].sort();
  }

  receive(chunk: string): void {
    for (const line of chunk.split('\n')) this.receiveLine(line.replace(/\r$/, ''));
  }

  private receiveLine(line: string): void {
    if (!line.startsWith('|')) return;
    const [, event = '', ...args] = line.split('|');
    if (event === 'request') {
      const parsed = JSON.parse(args.join('|')) as BattleRequest | null;
      if (parsed) this.ingestOwnRequest(parsed); else this.request = null;
      this.revision++;
      return;
    }
    if (event === 'jevselection') { this.setOpponentSelection(JSON.parse(args.join('|')) as string[]); return; }
    if (event.startsWith('-')) {
      const source = args.find(arg => arg.startsWith('[of] '))?.slice(5) ?? args[0] ?? '';
      const owner = this.identify(source);
      const ability = args.find(arg => arg.startsWith('[from] ability: '))?.slice(16);
      const item = args.find(arg => arg.startsWith('[from] item: '))?.slice(13);
      if (owner && ability) owner.abilityId = this.rememberName('ability', ability);
      // An effect may name its consumed item after -enditem (for example Sitrus
      // healing). An activation source is not evidence that it is held again.
      if (owner && item && owner.item.status !== 'none') owner.item = { status: 'known', cardId: this.rememberName('item', item) };
    }
    if (event === 'turn') {
      this.currentTurn = Number(args[0]);
      for (const pokemon of this.pokemon.values()) if (pokemon.slot !== null && pokemon.enteredTurn !== null && pokemon.enteredTurn < this.currentTurn - 1) pokemon.firstActionOpportunity = false;
      for (const pokemon of this.pokemon.values()) if ((this.protectionSucceeded.get(pokemon.id) ?? -1) < this.currentTurn - 1) pokemon.protectChain = 0;
    } else if (event === 'win' || event === 'tie') {
      this.isEnded = true; this.winner = event === 'win' ? args[0] ?? null : null;
    } else if (['switch', 'drag', 'replace'].includes(event)) {
      const pokemon = this.identify(args[0]!, args[1]);
      if (!pokemon) throw new Error(`Unrecognized public switch: ${args[0]}.`);
      const slot = /p[12]([ab]):/.exec(args[0]!)?.[1]?.charCodeAt(0);
      if (slot === undefined) throw new Error('Public switch is missing its active position.');
      for (const outgoing of this.pokemon.values()) if (outgoing.side === pokemon.side && outgoing.slot === slot - 97) {
        outgoing.slot = null; outgoing.statStages = zeroBoosts(); outgoing.effects = []; outgoing.protectChain = 0;
        outgoing.lastMoveId = null; outgoing.lastMoveTurn = null;
        this.protectionSucceeded.delete(outgoing.id);
      }
      pokemon.slot = slot - 97; pokemon.enteredTurn = this.currentTurn; pokemon.firstActionOpportunity = true;
      pokemon.statStages = zeroBoosts(); pokemon.effects = []; pokemon.protectChain = 0;
      this.setForm(pokemon, args[1]!); this.condition(pokemon, args[2]!);
    } else if (['detailschange', '-formechange'].includes(event)) {
      const pokemon = this.identify(args[0]!); if (pokemon) this.setForm(pokemon, args[1]!);
    } else if (event === '-mega') {
      const pokemon = this.identify(args[0]!); if (pokemon) {
        pokemon.megaEvolved = true;
        if (this.inferParticipantsFromEntries && args[2]) pokemon.item = { status: 'known', cardId: this.rememberName('item', args[2]) };
        const mega = this.members.get(pokemon.id)!.mega;
        if (mega) this.setForm(pokemon, mega.speciesId.replace('pokemon:', ''));
      }
    } else if (['-damage', '-heal'].includes(event)) {
      const pokemon = this.identify(args[0]!); if (pokemon) this.condition(pokemon, args[1]!);
    } else if (event === '-sethp') {
      for (let i = 0; i < args.length - 1; i += 2) {
        const pokemon = this.identify(args[i]!); if (pokemon) this.condition(pokemon, args[i + 1]!);
      }
    } else if (event === 'faint') {
      const pokemon = this.identify(args[0]!); if (pokemon) this.condition(pokemon, '0 fnt');
    } else if (['-status', '-curestatus'].includes(event)) {
      const pokemon = this.identify(args[0]!); if (pokemon) pokemon.status = event === '-status' ? args[1]! : null;
    } else if (event === '-cureteam') {
      const side = args[0]?.slice(0, 2); for (const pokemon of this.pokemon.values()) if (pokemon.side === side) pokemon.status = null;
    } else if (['-boost', '-unboost', '-setboost'].includes(event)) {
      const pokemon = this.identify(args[0]!); const stat = args[1] as keyof ReturnType<typeof zeroBoosts>;
      if (pokemon && stat in pokemon.statStages) {
        const delta = Number(args[2]);
        pokemon.statStages[stat] = Math.min(6, Math.max(-6, event === '-setboost' ? delta : pokemon.statStages[stat] + (event === '-unboost' ? -delta : delta)));
      }
    } else if (event === '-clearallboost') {
      for (const pokemon of this.pokemon.values()) pokemon.statStages = zeroBoosts();
    } else if (['-clearboost', '-clearnegativeboost', '-clearpositiveboost', '-invertboost'].includes(event)) {
      const pokemon = this.identify(args[0]!); if (pokemon) for (const stat of Object.keys(pokemon.statStages) as (keyof ReturnType<typeof zeroBoosts>)[]) {
        if (event === '-invertboost') pokemon.statStages[stat] *= -1;
        else if (event === '-clearboost' || (event === '-clearnegativeboost' && pokemon.statStages[stat] < 0) || (event === '-clearpositiveboost' && pokemon.statStages[stat] > 0)) pokemon.statStages[stat] = 0;
      }
    } else if (['-item', '-enditem'].includes(event)) {
      const pokemon = this.identify(args[0]!); if (pokemon) {
        const itemId = this.rememberName('item', args[1]!);
        pokemon.item = event === '-item' ? { status: 'known', cardId: itemId } : { status: 'none' };
        if (event === '-enditem') pokemon.lastItemLoss = { itemId, turn: this.currentTurn, consumed: args.includes('[eat]') ? true : null };
      }
      this.invalidatePP();
    } else if (event === '-ability') {
      const pokemon = this.identify(args[0]!); if (pokemon) pokemon.abilityId = this.rememberName('ability', args[1]!);
    } else if (event === '-endability') {
      const pokemon = this.identify(args[0]!); if (pokemon) pokemon.effects = this.effectChange(pokemon.effects, 'ability suppressed', true);
    } else if (['-start', '-end'].includes(event)) {
      const pokemon = this.identify(args[0]!); if (pokemon) pokemon.effects = this.effectChange(pokemon.effects, args[1]!, event === '-start');
    } else if (event === '-singleturn' && protectionMoves.has(toID(args[1] ?? ''))) {
      const pokemon = this.identify(args[0]!); if (pokemon) {
        pokemon.protectChain++;
        this.protectionSucceeded.set(pokemon.id, this.currentTurn);
      }
    } else if (event === '-fail') {
      const pokemon = this.identify(args[0]!);
      if (pokemon && pokemon.lastMoveTurn === this.currentTurn && protectionMoves.has(pokemon.lastMoveId?.replace('move:', '') ?? '')) {
        pokemon.protectChain = 0; this.protectionSucceeded.delete(pokemon.id);
      }
    } else if (event === '-weather') {
      if (!args.includes('[upkeep]')) {
        this.field = this.field.filter(effect => !effect.name.startsWith('weather:'));
        if (args[0] !== 'none') this.field.push({ name: `weather:${args[0]}`, sinceTurn: this.currentTurn, remainingTurns: null });
      }
    } else if (['-fieldstart', '-fieldend'].includes(event)) {
      this.field = this.effectChange(this.field, args[0]!, event === '-fieldstart');
    } else if (['-sidestart', '-sideend'].includes(event)) {
      const side = args[0]?.slice(0, 2) as Side;
      if (side === 'p1' || side === 'p2') this.sideConditions[side] = this.effectChange(this.sideConditions[side], args[1]!, event === '-sidestart');
    } else if (event === 'move') {
      this.invalidatePP();
      const pokemon = this.identify(args[0]!); if (pokemon) {
        const moveId = this.rememberName('move', args[1]!);
        if (!pokemon.knownMoveIds.includes(moveId)) pokemon.knownMoveIds.push(moveId);
        pokemon.lastMoveId = moveId; pokemon.lastMoveTurn = this.currentTurn; pokemon.firstActionOpportunity = false;
        if (!protectionMoves.has(toID(args[1]!))) pokemon.protectChain = 0;
        this.moveHistory.push({ turn: this.currentTurn, actorId: pokemon.id, moveId, targetId: this.identify(args[2] ?? '')?.id ?? null });
      }
    } else if (event === '-activate' || event === '-restorepp' || event === 'cant') {
      if (this.inferParticipantsFromEntries && event === '-activate') {
        const pokemon = this.identify(args[0]!);
        if (pokemon && args[1]?.startsWith('ability: ')) pokemon.abilityId = this.rememberName('ability', args[1].slice(9));
        if (pokemon && args[1]?.startsWith('item: ') && pokemon.item.status !== 'none') {
          pokemon.item = { status: 'known', cardId: this.rememberName('item', args[1].slice(6)) };
        }
      }
      this.invalidatePP();
    }
    // Protocol events are whitelisted. Chat, timestamps, logs, HTML and opponent choices cannot enter model state.
    if (event === 'turn' || event === 'win' || event === 'tie' || event === 'move' || event === 'cant' || event === 'faint' ||
      ['switch', 'drag', 'replace', 'detailschange'].includes(event) || event.startsWith('-')) {
      this.publicEvents.push(line);
      this.publicEvents = this.publicEvents.slice(-36);
      this.moveHistory = this.moveHistory.slice(-32);
      this.revision++;
    }
  }

  private effectChange(effects: Effect[], name: string, start: boolean): Effect[] {
    const next = effects.filter(effect => toID(effect.name) !== toID(name));
    if (start) next.push({ name, sinceTurn: this.currentTurn, remainingTurns: null });
    return next;
  }

  private ownMember(entry: RequestPokemon): { id: string; name: string } {
    const pokemon = this.identify(entry.ident, entry.details);
    if (!pokemon) throw new Error(`Unrecognized request identity: ${entry.ident}.`);
    return { id: pokemon.id, name: pokemon.name };
  }

  decision(): DecisionInput | null {
    const request = this.request;
    if (this.isEnded || !request || request.wait || !request.side || (!this.opponentSelection && !this.inferParticipantsFromEntries)) return null;
    const phase = request.teamPreview ? 'team-preview' : request.forceSwitch ? 'replacement' : 'move';
    // A public faint also proves participation, even in a partial log without
    // that Pokemon's earlier entry. Never infer it as a healthy unseen reserve.
    const observedOpponentIds = [...this.pokemon.values()].filter(p => p.side === 'p1' && (p.enteredTurn !== null || p.fainted === true)).map(p => p.id);
    const relevant = [...this.pokemon.values()].filter(pokemon => pokemon.side === 'p1'
      ? this.inferParticipantsFromEntries ? phase === 'team-preview' || observedOpponentIds.includes(pokemon.id) : this.opponentSelection!.includes(pokemon.id)
      : phase === 'team-preview' || !this.ownSelection || this.ownSelection.includes(pokemon.id));
    let candidates = phase === 'team-preview'
      ? buildPreviewActions(request.side.pokemon.map(entry => this.ownMember(entry)), request.maxChosenTeamSize ?? 4)
      : buildTurnActions(request, relevant.filter(pokemon => pokemon.side === 'p1' && pokemon.slot !== null).map(pokemon => ({
        id: pokemon.id, name: pokemon.name, slot: pokemon.slot!, alive: !pokemon.fainted,
      })));
    candidates = candidates.filter(candidate => !this.rejectedCommands.includes(candidate.command));
    if (!candidates.length) throw new Error('Every candidate for this request has been rejected; retry requires a corrected request.');
    const state: Record<string, unknown> = {
      request: { battleId: this.battleId, rqid: request.rqid ?? null, turn: this.currentTurn, phase, ourSide: 'p2' },
      formatId: 'gen9championsvgc2026regmc',
      informationPolicy: {
        mode: this.informationPolicy, sets: this.informationPolicy === 'revealed-demo' ? 'Both complete initial sets are explicitly disclosed.' : 'Only own sets and publicly revealed opposing information are known.',
        opponentSelection: this.inferParticipantsFromEntries ? 'Only public entries identify opposing participants. Unseen reserves and the selected four are not disclosed.' : 'The four selected identities are explicitly disclosed as an unordered set. Their order and leads are not disclosed before the battle starts.',
        opponentPendingCommands: 'hidden',
      },
      opponentSelectedIds: this.inferParticipantsFromEntries ? observedOpponentIds.length === 4 ? observedOpponentIds : null : [...this.opponentSelection!],
      ...(this.inferParticipantsFromEntries ? { opponentPreview: this.teams.human.members.map(p => ({ id: p.id, speciesId: p.speciesId })), observedOpponentIds } : {}),
      ownSelectedIds: this.ownSelection ? [...this.ownSelection] : null,
      pokemon: relevant.map(pokemon => {
        const member = this.members.get(pokemon.id)!;
        const disclosed = pokemon.side === 'p2' || this.informationPolicy === 'revealed-demo';
        const megaSpent = [...this.pokemon.values()].some(other => other.side === pokemon.side && other.megaEvolved);
        const compatibleStoneKnown = pokemon.item.status === 'known' && pokemon.item.cardId === `item:${toID(member.set.item)}`;
        return {
          ...structuredClone(pokemon),
          initialSetDetails: disclosed ? { nature: member.set.nature, gender: member.set.gender ?? null, points: { ...member.set.evs } } : null,
          availableMegaForm: member.mega && disclosed && compatibleStoneKnown && !megaSpent ? {
            speciesId: member.mega.speciesId,
            typeIds: member.mega.types.map(type => type.startsWith('type:') ? type : `type:${toID(type)}`),
            abilityId: member.mega.abilityId, unmodifiedStats: { ...member.mega.stats },
            provenance: 'Computed from the explicitly disclosed initial set, not a revealed transformation or opponent commitment.',
          } : null,
        };
      }),
      field: structuredClone(this.field), sideConditions: structuredClone(this.sideConditions),
      moveHistory: structuredClone(this.moveHistory), recentPublicEvents: [...this.publicEvents],
      actionConstraints: { forceSwitch: request.forceSwitch ?? null, active: request.active?.map(active => active ? {
        trapped: active.trapped ?? false, maybeTrapped: active.maybeTrapped ?? false,
        canMegaEvolve: Boolean(active.canMegaEvo || active.canMegaEvoX || active.canMegaEvoY),
        moves: active.moves.map(move => ({ moveId: `move:${toID(move.id)}`, pp: move.pp ?? null, maxPP: move.maxpp ?? null, target: move.target ?? null, disabled: Boolean(move.disabled) })),
      } : null) ?? null },
      winner: this.winner,
    };
    const required = new Set(['C01', 'C02', 'C03', 'C05', 'C07', 'C08', 'C10', 'C12', 'C17', 'C18', 'C19', 'C20']);
    for (const pokemon of relevant) {
      required.add(pokemon.speciesId); for (const typeId of pokemon.typeIds) required.add(typeId);
      if (pokemon.abilityId) required.add(pokemon.abilityId);
      if (pokemon.item.status === 'known') required.add(pokemon.item.cardId);
      for (const move of pokemon.knownMoveIds) if (move === 'move:recharge') required.add('M23'); else required.add(move);
      const statusCards: Record<string, string> = { brn: 'M01', psn: 'M02', tox: 'M02', par: 'M03', slp: 'M04', frz: 'M05' };
      if (pokemon.status && statusCards[pokemon.status]) required.add(statusCards[pokemon.status]!);
      if (pokemon.effects.length) required.add('C15');
      const member = this.members.get(pokemon.id)!;
      if (member.mega && (pokemon.side === 'p2' || this.informationPolicy === 'revealed-demo' || pokemon.megaEvolved)) {
        required.add(member.mega.speciesId); required.add(member.mega.abilityId);
      }
    }
    if (this.field.length) { required.add('M15'); required.add('M16'); required.add('M21'); }
    if (Object.values(this.sideConditions).some(effects => effects.length)) { required.add('M11'); required.add('M21'); }
    for (const active of request.active ?? []) for (const move of active?.moves ?? []) {
      if (toID(move.id) === 'recharge') required.add('M23'); else required.add(`move:${toID(move.id)}`);
    }
    // Only names of already authorized facts are exported, never the fixture's
    // undisclosed moves/items/abilities or the opponent's unselected members.
    const namedFacts = new Set([...required, ...relevant.flatMap(pokemon => pokemon.lastItemLoss ? [pokemon.lastItemLoss.itemId] : [])]);
    state.entityNames = Object.fromEntries([...namedFacts].filter(id => this.entityNames.has(id)).map(id => [id, this.entityNames.get(id)!]));
    const key = createHash('sha256').update(JSON.stringify({ state, commands: candidates.map(candidate => candidate.command), revision: this.revision })).digest('hex');
    return { phase, state, requiredCardIds: [...required].sort(), candidates, key };
  }
}
