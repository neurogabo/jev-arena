import { loadEngine, formatId } from '../showdown/engine.js';
import type { HypothesisSet, SimObservation } from './types.js';
import { applyObservedEffects, refreshObservedRestrictions, validateObservedEffects } from './effects.js';
import { prepareReplacementState } from './replacement.js';

type Mon = Record<string, any>;
const id = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
const effectId = (value: string) => id(value.replace(/^(?:move|ability|weather):\s*/i, ''));
const stats = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const;
const points = (): Record<typeof stats[number], number> => ({ hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 });
// Predeclared, legal Champions point profiles. These are hypotheses, never
// inferred opponent stats. Every action is tested against the same profiles.
export const TRAINING_PROFILES = [
  { id: 'neutral', points: points() },
  { id: 'physical-fast', points: { ...points(), atk: 32, spe: 32 } },
  { id: 'special-fast', points: { ...points(), spa: 32, spe: 32 } },
  { id: 'bulky', points: { ...points(), hp: 32, def: 16, spd: 16 } },
] as const;
const fields = new Set(['raindance', 'sunnyday', 'sandstorm', 'snow', 'snowscape', 'hail',
  'electricterrain', 'grassyterrain', 'psychicterrain', 'mistyterrain', 'trickroom', 'gravity', 'magicroom', 'wonderroom']);

/** Only observed facts enter this builder. The synthetic snapshots are private. */
export async function buildSimHypotheses(observation: SimObservation, options: {
  unknownReserveHP?: 'bounds';
  /** Only a separate public-evidence hypothesis builder may enable this on its private copy. */
  completedHiddenSets?: boolean;
} = {}): Promise<HypothesisSet> {
  const state = observation.input.state as Mon;
  const ownSide = observation.request.side?.id;
  const unsupported = new Set<string>((observation.audit.unsupportedTransitions as string[] | undefined) ?? []);
  const assumptions = [
    'Synthetic one-turn branches, not a reconstruction of hidden engine state or a guarantee.',
    'Opponent training is unknown: neutral-zero, physical-fast, special-fast and bulky point profiles are sampled with the public nature. These are not known training.',
    'Unknown opposing and reserve PP are assumed full. Observed own active PP and restrictions take precedence.',
    'Field/side timers follow public start turns and standard durations; unknown extender sources are explicitly sampled assumptions.',
    'Four training profiles crossed with two correlated HP/timer endpoints are sampled, not all cross-products across Pokemon or all possible spreads.',
    'Opposing reserve ordering is synthetic (current active slots first, then public sheet order); own request roster order is exact.',
  ];
  if (options.completedHiddenSets) {
    assumptions[1] = 'Opponent sets and training are explicit wiki-derived hypotheses conditioned on public reveals, not known facts.';
    assumptions[4] = 'Each declared set world is crossed with low/high HP and timer endpoints; this is not exhaustive.';
  }
  if (!['move', 'replacement'].includes(observation.input.phase)) unsupported.add('Only move and replacement decisions are supported.');
  if (ownSide !== 'p1' && ownSide !== 'p2') unsupported.add('Missing own side.');
  const mons = structuredClone(state.pokemon ?? []) as Mon[];
  if (mons.length !== 8) unsupported.add('Exactly four publicly established participants per side are required.');
  const engine = await loadEngine();
  const dex = engine.Dex.forFormat(formatId);
  for (const mon of mons.filter(mon => !mon.fainted)) {
    if (!mon.movesComplete || !mon.knownMoveIds?.length) unsupported.add(`${mon.id}: complete public moves are required.`);
    if (!mon.abilityId || !dex.abilities.get(mon.abilityId.slice(8)).exists) unsupported.add(`${mon.id}: unknown pinned-engine ability ${mon.abilityId}.`);
    if (mon.item?.status === 'unknown') unsupported.add(`${mon.id}: unknown current item.`);
    if (mon.item?.status === 'known') {
      const item = dex.items.get(mon.item.cardId.slice(5));
      if (!item.exists) unsupported.add(`${mon.id}: unknown pinned-engine item ${item.id}.`);
    }
    for (const move of mon.knownMoveIds ?? []) if (!dex.moves.get(move.slice(5)).exists && move !== 'move:recharge') unsupported.add(`${mon.id}: unknown pinned-engine move ${move}.`);
    if (mon.side === ownSide && (!mon.stats || !mon.hp?.exact)) unsupported.add(`${mon.id}: exact own stats/HP unavailable.`);
    if (mon.side !== ownSide && !/^\d+\/100[gyr]?(?:\s|$)/.test(mon.simObservedCondition ?? '') &&
      !(options.unknownReserveHP === 'bounds' && mon.slot === null && mon.simObservedCondition === null)) {
      unsupported.add(`${mon.id}: opposing displayed percentage HP unavailable.`);
    }
  }
  for (const effect of state.field ?? []) if (!fields.has(effectId(effect.name))) unsupported.add(`Unsupported field ${effect.name}.`);
  for (const reason of validateObservedEffects(state)) unsupported.add(reason);
  for (const active of observation.request.active ?? []) {
    if (active?.maybeTrapped || active?.maybeDisabled) assumptions.push('Request reports possible trapping/disabling: the current native offered menu is retained; hypothetical refusals remain unknown outcomes.');
  }
  const coverage = options.completedHiddenSets ? 'One declared hypothetical set world by two HP/timer endpoints; conditional, not exhaustive.' : 'Eight synthetic public-HP-compatible hypotheses: four declared opponent point profiles by low/high HP/timer endpoints; sampled, not exhaustive. Mega uses point spreads compatible with exact own current stats.';
  const result: HypothesisSet = { hypotheses: [], unsupported: [...unsupported], coverage,
    audit: { source: 'SimObservation authorized player log only; no fixture state, oracle, opponent request, or original seed.',
      ownSide, observationKey: observation.input.key, mechanics: 'Moves, items and abilities are executed by the pinned engine Dex, not manual allowlists.',
      trainingProfiles: TRAINING_PROFILES,
      hpPolicy: 'Pinned Champions getHealth().shared exact display matching, including 20/50 color suffixes.',
      ownRoster: observation.request.side?.pokemon.map(mon => mon.ident), assumptions } };
  if (unsupported.size) return result;
  const roster = (side: string) => side === ownSide
    ? observation.request.side!.pokemon.map(entry => mons.find(mon => mon.side === side && `${side}: ${mon.name}` === entry.ident)!)
    : [...mons.filter(mon => mon.side === side && mon.slot !== null).sort((a, b) => a.slot - b.slot),
      ...mons.filter(mon => mon.side === side && mon.slot === null)];
  const rosters = { p1: roster('p1'), p2: roster('p2') };
  if (Object.values(rosters).some(team => team.length !== 4 || team.some(mon => !mon))) {
    result.unsupported.push('Could not preserve all four roster identities.'); return result;
  }
  // Recreate from scratch for each endpoint; setup entry effects are discarded
  // below before the public current position is restored, never counted twice.
  for (const profile of (options.completedHiddenSets ? TRAINING_PROFILES.slice(0, 1) : TRAINING_PROFILES)) for (const endpoint of ['low', 'high'] as const) {
    const branchAssumptions = [...assumptions];
    if (!options.completedHiddenSets) branchAssumptions.push(`Opponent point profile ${profile.id}: ${stats.map(stat => `${stat}=${profile.points[stat] ?? 0}`).join(', ')} for each opponent; hypothetical, not known training.`);
    const remainingDuration = (effect: Mon, base: number, label: string, extended = false) => {
      const elapsed = Math.max(0, state.request.turn - Math.max(1, effect.sinceTurn));
      let duration = effect.simTimerEvidence?.duration ?? base;
      if (extended && !effect.simTimerEvidence) {
        // The observer does not retain the setter/item-at-start relationship.
        // Choose a compatible standard duration, explicitly hypothetical.
        duration = elapsed < base && endpoint === 'low' ? base : 8;
        branchAssumptions.push(`${label}: source extender unknown; assume initial duration ${duration}, public start turn ${effect.sinceTurn}, elapsed ${elapsed}.`);
      }
      if (elapsed >= duration) throw new Error(`${label}: still-active effect conflicts with public start turn and supported duration.`);
      return duration - elapsed;
    };
    const battle = new engine.Battle({ formatid: formatId, seed: [91, 17, 53, 29] });
    try {
      for (const side of ['p1', 'p2'] as const) {
        const sets = rosters[side].map(mon => {
          const species = dex.species.get(mon.speciesId.slice(8));
          const set = { name: mon.name, species: species.name, ability: mon.abilityId?.slice(8) || species.abilities['0'],
            item: mon.item?.status === 'known' ? mon.item.cardId.slice(5) : '', nature: mon.initialSetDetails?.nature || 'Serious',
            level: mon.level, gender: mon.gender || undefined, moves: mon.knownMoveIds.filter((move: string) => move !== 'move:recharge').map((move: string) => move.slice(5)),
            evs: side === ownSide ? points() : options.completedHiddenSets ? { ...mon.initialSetDetails.evs } : { ...profile.points } };
          if (!set.moves.length) set.moves = ['protect']; // Fainted entries only; they never become selectable.
          if (side === ownSide && mon.stats) {
            if (options.completedHiddenSets && !mon.initialSetDetails?.nature) {
              // Player requests contain exact stats but omit nature. Find a legal
              // compatible nature/spread, never read the actual configured team.
              const fits = dex.natures.all().map((nature: any) => {
                const evs = points();
                for (const stat of stats) {
                  const value = Array.from({ length: 33 }, (_, n) => n).find(n =>
                    battle.spreadModify(species.baseStats, { ...set, nature: nature.name, evs: { ...evs, [stat]: n } })[stat] === mon.stats[stat]);
                  if (value === undefined) return null;
                  evs[stat] = value;
                }
                return Object.values(evs).reduce((a, b) => a + b, 0) <= 66 ? { nature: nature.name, evs } : null;
              }).filter(Boolean);
              if (!fits.length) throw new Error(`${mon.id}: no legal backing nature/points match the exact own request stats.`);
              set.nature = fits[0]!.nature;
              branchAssumptions.push(`${mon.id}: own nature is absent from the request; ${fits.length} stat-compatible natures, using ${set.nature}. Current stats remain exact; future Mega stats are conditional on that backing nature.`);
            }
            // Current request statistics are authoritative. Infer only a
            // compatible backing spread so switching preserves those stats.
            // Any ambiguity is declared. Native Mega stat recalculation uses
            // this same compatible backing spread and the public held stone.
            for (const stat of stats) {
              const compatible: number[] = [];
              for (let value = 0; value <= 32; value++) {
                if (battle.spreadModify(species.baseStats, { ...set, evs: { ...set.evs, [stat]: value } })[stat] === mon.stats[stat]) compatible.push(value);
              }
              if (!compatible.length) throw new Error(`${mon.id}: own ${stat} cannot be reproduced from current species and public nature.`);
              set.evs[stat] = options.completedHiddenSets || endpoint === 'low' ? compatible[0]! : compatible.at(-1)!;
              if (compatible.length > 1) branchAssumptions.push(`${mon.id}: ${stat} backing points sampled ${set.evs[stat]} among ${compatible.join('/')}; exact current request stat is preserved, Mega uses this compatible spread.`);
            }
          }
          return set;
        });
        battle.setPlayer(side, { name: side, team: sets });
      }
      if (!battle.choose('p1', 'team 1234') || !battle.choose('p2', 'team 1234')) throw new Error('Synthetic team selection was rejected.');
      battle.turn = state.request.turn;
      battle.queue.clear(); battle.faintQueue = [];
      battle.field.weather = ''; battle.field.weatherState = battle.initEffectState({ id: '' });
      battle.field.terrain = ''; battle.field.terrainState = battle.initEffectState({ id: '' });
      battle.field.pseudoWeather = {};
      const actorIds: Record<string, string> = {};
      const actorById: Record<string, any> = {};
      const hpRanges: Mon[] = [];
      for (const side of ['p1', 'p2'] as const) {
        const engineSide = battle[side];
        engineSide.sideConditions = {};
        for (const [index, mon] of rosters[side].entries()) {
          const pokemon = engineSide.pokemon[index];
          actorIds[pokemon.fullname] = mon.id;
          actorById[mon.id] = pokemon;
          pokemon.volatiles = {};
          pokemon.boosts = { ...mon.statStages };
          pokemon.ability = mon.abilityId?.slice(8) || pokemon.ability;
          pokemon.baseAbility = pokemon.ability;
          pokemon.abilityState = battle.initEffectState({ id: pokemon.ability, target: pokemon, started: mon.slot !== null });
          pokemon.item = mon.item?.status === 'known' ? mon.item.cardId.slice(5) : '';
          pokemon.itemState = battle.initEffectState({ id: pokemon.item, target: pokemon });
          pokemon.lastItem = mon.lastItemLoss?.itemId?.slice(5) ?? '';
          pokemon.ateBerry = mon.lastItemLoss?.consumed === true;
          pokemon.status = mon.status ?? '';
          pokemon.statusState = battle.initEffectState({ id: pokemon.status, target: pokemon });
          pokemon.fainted = mon.fainted; pokemon.faintQueued = false;
          pokemon.isActive = mon.slot !== null; pokemon.position = index;
          pokemon.activeTurns = mon.firstActionOpportunity ? 0 : Math.max(1, state.request.turn - (mon.enteredTurn ?? state.request.turn - 1));
          pokemon.activeMoveActions = mon.simMoveAttempts;
          pokemon.newlySwitched = Boolean(mon.firstActionOpportunity);
          pokemon.lastMove = mon.lastMoveId ? battle.dex.getActiveMove(mon.lastMoveId.slice(5)) : null;
          pokemon.lastMoveUsed = pokemon.lastMove;
          pokemon.moveThisTurn = ''; pokemon.moveThisTurnResult = undefined; pokemon.hurtThisTurn = null;
          pokemon.switchFlag = false; pokemon.forceSwitchFlag = false;
          if (mon.side === ownSide && mon.stats) {
            pokemon.baseStoredStats = { ...mon.stats };
            pokemon.storedStats = Object.fromEntries(stats.filter(stat => stat !== 'hp').map(stat => [stat, mon.stats[stat]]));
            pokemon.maxhp = mon.stats.hp; pokemon.baseMaxhp = mon.stats.hp;
            pokemon.hp = mon.fainted ? 0 : mon.hp.exact.current;
          } else if (mon.fainted) pokemon.hp = 0;
          else if (options.unknownReserveHP === 'bounds' && mon.slot === null && mon.simObservedCondition === null) {
            pokemon.hp = endpoint === 'low' ? 1 : pokemon.maxhp;
            branchAssumptions.push(`${mon.id}: selected reserve has no observed HP; sampling ${pokemon.hp} from 1..${pokemon.maxhp}. This is an explicit HP hypothesis, not a revealed condition. These correlated endpoints do not cover all combinations.`);
          } else {
            const display = mon.simObservedCondition.split(' ')[0];
            const matchingHP = () => {
              const values: number[] = [];
              for (let hp = 1; hp <= pokemon.maxhp; hp++) {
                pokemon.hp = hp;
                if (pokemon.getHealth().shared.split(' ')[0] === display) values.push(hp);
              }
              return values;
            };
            let compatible = matchingHP();
            if (!compatible.length) {
              // Exact 20%/50% color boundaries can rule out particular max HP.
              // Fit the nearest legal HP point value using the native display;
              // never erase a color suffix or substitute a contradictory HP.
              const original = pokemon.set.evs.hp;
              const otherPoints = stats.filter(stat => stat !== 'hp').reduce((sum, stat) => sum + pokemon.set.evs[stat], 0);
              const maxPoints = Math.min(32, (options.completedHiddenSets ? 66 : 64) - otherPoints);
              const ordered = Array.from({ length: Math.max(0, maxPoints + 1) }, (_, value) => value)
                .sort((a, b) => Math.abs(a - original) - Math.abs(b - original) || a - b);
              for (const value of ordered) {
                pokemon.set.evs.hp = value;
                pokemon.maxhp = battle.spreadModify(pokemon.species.baseStats, pokemon.set).hp;
                pokemon.baseMaxhp = pokemon.maxhp;
                compatible = matchingHP();
                if (compatible.length) {
                  branchAssumptions.push(`${mon.id}: ${profile.id} HP points adjusted ${original}->${value}, the nearest legal value compatible with public ${display}; other sampled point values unchanged.`);
                  break;
                }
              }
            }
            if (!compatible.length) throw new Error(`${mon.id}: hypothetical ${profile.id} HP has no value compatible with ${display}.`);
            pokemon.hp = endpoint === 'low' ? compatible[0]! : compatible.at(-1)!;
            hpRanges.push({ actorId: mon.id, displayed: display, min: compatible[0], max: compatible.at(-1), assumed: pokemon.hp, hypotheticalMaxHP: pokemon.maxhp });
          }
          const requestIndex = side === ownSide && mon.slot !== null ? mon.slot : -1;
          const activeRequest = observation.request.active?.[requestIndex];
          for (const slot of pokemon.moveSlots) {
            const observed = activeRequest?.moves.find(move => id(move.id) === slot.id);
            if (observed) {
              if (observed.pp !== undefined) slot.pp = observed.pp;
              if (observed.maxpp !== undefined) slot.maxpp = observed.maxpp;
              slot.disabled = Boolean(observed.disabled);
              slot.disabledSource = observed.disabled ? 'observed-request' : '';
            }
          }
          if (activeRequest?.moves.length === 1 && activeRequest.moves[0]?.id === 'struggle') {
            for (const slot of pokemon.moveSlots) { slot.pp = 0; slot.disabled = false; }
            branchAssumptions.push(`${mon.id}: current request permits Struggle only; synthetic original PP set to zero to reproduce that menu, without claiming actual hidden PP or why other moves are unavailable.`);
          }
          if (activeRequest?.moves.length === 1 && activeRequest.moves[0]?.id === 'recharge') {
            pokemon.volatiles.mustrecharge = battle.initEffectState({ id: 'mustrecharge', target: pokemon, duration: 2 });
          }
          // Native eligibility is recomputed on the synthetic set, then bound
          // to our authoritative current request rather than invented actions.
          if (rosters[side].some(member => member.megaEvolved)) pokemon.canMegaEvo = pokemon.canMegaEvoX = pokemon.canMegaEvoY = false;
          else if (side === ownSide && activeRequest) {
            if (!activeRequest.canMegaEvo) pokemon.canMegaEvo = false;
            if (!activeRequest.canMegaEvoX) pokemon.canMegaEvoX = false;
            if (!activeRequest.canMegaEvoY) pokemon.canMegaEvoY = false;
          }
          if (mon.megaEvolved) branchAssumptions.push(`${mon.id}: current public Mega form retained; opposing stats use declared hypothetical ${profile.id} training.`);
        }
        engineSide.active = [0, 1].map(slot => {
          const index = rosters[side].findIndex(mon => mon.slot === slot);
          if (index < 0) throw new Error(`${side}: active position ${slot} has no observed identity, including fainted slots.`);
          return engineSide.pokemon[index];
        });
        engineSide.pokemonLeft = rosters[side].filter(mon => !mon.fainted).length;
        engineSide.totalFainted = rosters[side].filter(mon => mon.fainted).length;
      }
      applyObservedEffects({ battle, state, mons, actorById, endpoint, assumptions: branchAssumptions });
      for (const effect of state.field ?? []) {
        const name = effectId(effect.name);
        if (effect.name.startsWith('weather:')) {
          battle.field.weather = name === 'snowscape' ? 'snow' : name;
          battle.field.weatherState = battle.initEffectState({ id: battle.field.weather, duration: remainingDuration(effect, 5, name, true) });
        } else if (name.endsWith('terrain')) {
          battle.field.terrain = name; battle.field.terrainState = battle.initEffectState({ id: name, duration: remainingDuration(effect, 5, name, true) });
        } else battle.field.pseudoWeather[name] = battle.initEffectState({ id: name, duration: remainingDuration(effect, 5, name) });
      }
      refreshObservedRestrictions(battle);
      if (observation.input.phase === 'replacement') prepareReplacementState({ battle, observation, actorById, assumptions: branchAssumptions, endpoint });
      else battle.makeRequest('move');
      const own = battle[ownSide!];
      own.activeRequest = structuredClone(observation.request);
      // Reassert observed restrictions after request generation, which may
      // recompute disabling from reconstructed effects.
      for (let index = 0; index < own.active.length; index++) {
        const active = own.active[index]; const current = observation.request.active?.[index];
        if (!current) continue;
        active.trapped = Boolean(current.trapped);
        for (const slot of active.moveSlots) {
          const observed = current.moves.find(move => id(move.id) === slot.id);
          if (observed) slot.disabled = Boolean(observed.disabled);
        }
      }
      for (const candidate of observation.input.candidates) {
        own.clearChoice();
        if (!own.choose(candidate.command) || !own.isChoiceDone()) throw new Error(`Observed action does not map to synthetic state: ${candidate.command}: ${own.choice.error}`);
      }
      own.clearChoice();
      // Constructor logs contain wall-clock timestamps and synthetic entry
      // events, neither of which is evidence about this observed position.
      battle.log = []; battle.inputLog = []; battle.sentLogPos = 0;
      if (options.completedHiddenSets) result.audit[`inferredPoints_${endpoint}`] = Object.fromEntries(
        mons.filter(mon => mon.side !== ownSide).map(mon => [mon.id, { ...actorById[mon.id].set.evs }]));
      result.hypotheses.push({ id: `${profile.id}-hp-${endpoint}`, assumptions: [...new Set(branchAssumptions),
        ...hpRanges.map(range => `${range.actorId}: ${range.displayed} corresponds to ${range.min}..${range.max}/${range.hypotheticalMaxHP} under hypothetical training; sampling ${range.assumed}.`)],
        actorIds, snapshot: JSON.stringify(battle.toJSON()) });
      result.audit[`hpRanges_${profile.id}_${endpoint}`] = hpRanges;
    } catch (error) {
      result.unsupported.push(error instanceof Error ? error.message : String(error));
      result.audit.constructionError = error instanceof Error ? error.stack : String(error);
      result.hypotheses = []; return result;
    } finally { battle.destroy(); }
  }
  return result;
}
