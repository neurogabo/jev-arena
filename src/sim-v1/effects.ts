import type { BattleRequest } from '../showdown/actions.js';

type Value = Record<string, any>;
const id = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
export const simEffectId = (value: string) => id(value.replace(/^(?:move|ability|weather):\s*/i, ''));
const singleTurns = new Set(['protect', 'detect', 'endure', 'wideguard', 'quickguard', 'spikyshield',
  'kingsshield', 'banefulbunker', 'silktrap', 'burningbulwark', 'followme', 'ragepowder', 'helpinghand', 'flinch']);
const supported = new Set([...singleTurns, 'mustrecharge', 'leechseed', 'substitute', 'disable', 'encore',
  'taunt', 'torment', 'choicelock', 'confusion', 'perishsong']);
const supportedSides = new Set(['reflect', 'lightscreen', 'auroraveil', 'tailwind', 'safeguard', 'mist',
  'spikes', 'toxicspikes', 'stealthrock', 'stickyweb', 'wideguard', 'quickguard']);
const effectsFor = (mon: Value): Value[] => {
  const effects = new Map<string, Value>();
  for (const effect of mon.effects ?? []) {
    const raw = simEffectId(effect.name), name = /^perish[0-3]$/.test(raw) ? 'perishsong' : raw;
    effects.set(name, { sinceTurn: effect.sinceTurn, ...effect, id: name });
  }
  for (const effect of mon.simVolatiles ?? []) effects.set(effect.id, { ...effects.get(effect.id), ...effect });
  return [...effects.values()];
};

/** Capture only evidence from the authorized log. Unknown internals stay bounds. */
export function enrichObservedEffects(state: Value, request: BattleRequest, log: readonly string[]): void {
  const mons = state.pokemon as Value[];
  const find = (ident: string) => {
    const match = /^(p[12])(?:[ab])?: (.+)$/.exec(ident);
    return match ? mons.find(mon => mon.side === match[1] && id(mon.name) === id(match[2]!)) : undefined;
  };
  const evidence = new Map<string, Map<string, Value>>();
  const sleep = new Map<string, { observedStart: boolean; attempts: number; rest: boolean }>();
  const choiceMove = new Map<string, string>();
  const sideLayers = new Map<string, number>();
  let lastMove: { sourceId: string; move: string; targetId?: string; turn: number } | undefined;
  let turn = 0;
  for (const [sequence, line] of log.entries()) {
    const [, event = '', ident = '', name = '', value = '', ...extras] = line.split('|');
    const mon = find(ident);
    if (event === 'turn') turn = Number(ident);
    if ((event === 'switch' || event === 'drag') && mon) {
      evidence.delete(mon.id); choiceMove.delete(mon.id);
    }
    if (event === '-status' && mon && name === 'slp') {
      sleep.set(mon.id, { observedStart: true, attempts: 0, rest: [value, ...extras].some(part => /move: Rest/.test(part)) });
    }
    if ((event === '-curestatus' || event === 'faint') && mon) sleep.delete(mon.id);
    if (event === 'cant' && mon && name === 'slp') {
      const prior = sleep.get(mon.id) ?? { observedStart: false, attempts: 0, rest: false };
      prior.attempts++; sleep.set(mon.id, prior);
    }
    if (event === 'move' && mon) {
      lastMove = { sourceId: mon.id, move: id(name), targetId: find(value)?.id, turn };
      choiceMove.set(mon.id, id(name));
    }
    if ((event === '-enditem' || event === '-item') && mon) choiceMove.delete(mon.id);
    if ((event === '-start' || event === '-singleturn' || event === '-singlemove') && mon) {
      const effect = simEffectId(name);
      if (!evidence.has(mon.id)) evidence.set(mon.id, new Map());
      const sourceToken = [value, ...extras].find(part => part.startsWith('[of] '));
      const sourceId = sourceToken ? find(sourceToken.slice(5))?.id
        : lastMove?.move === effect && lastMove.turn === turn && (!lastMove.targetId || lastMove.targetId === mon.id) ? lastMove.sourceId : undefined;
      evidence.get(mon.id)!.set(effect, { id: effect, sinceTurn: turn, sequence,
        ...(sourceId ? { sourceId } : {}),
        ...(effect === 'disable' && value && !value.startsWith('[') ? { moveId: id(value) } : {}),
        ...(event === '-singleturn' ? { singleTurn: true } : {}),
        ...(effect === 'substitute' ? { damaged: false } : {}),
      });
    }
    if (event === '-end' && mon) evidence.get(mon.id)?.delete(simEffectId(name));
    if (event === '-activate' && mon && simEffectId(name) === 'substitute' && [value, ...extras].includes('[damage]')) {
      const entry = evidence.get(mon.id)?.get('substitute'); if (entry) entry.damaged = true;
    }
    if (event === '-mustrecharge' && mon) {
      if (!evidence.has(mon.id)) evidence.set(mon.id, new Map());
      evidence.get(mon.id)!.set('mustrecharge', { id: 'mustrecharge', sinceTurn: turn, sequence });
    }
    if (event === 'cant' && name === 'recharge' && mon) evidence.get(mon.id)?.delete('mustrecharge');
    if (event === '-sidestart') {
      const key = `${ident.slice(0, 2)}:${simEffectId(name)}`;
      sideLayers.set(key, (sideLayers.get(key) ?? 0) + 1);
    }
    if (event === '-sideend') sideLayers.delete(`${ident.slice(0, 2)}:${simEffectId(name)}`);
  }
  for (const mon of mons) {
    const current = new Map((mon.effects ?? []).map((effect: Value) => [simEffectId(effect.name), effect])) as Map<string, Value>;
    for (const effect of evidence.get(mon.id)?.values() ?? []) {
      if (effect.singleTurn && effect.sinceTurn === turn) current.set(effect.id, { name: effect.id, sinceTurn: turn });
      if (effect.id === 'mustrecharge') current.set(effect.id, { name: effect.id, sinceTurn: effect.sinceTurn });
    }
    mon.simVolatiles = [...current].map(([name, effect]) => ({
      sinceTurn: effect.sinceTurn ?? turn, ...evidence.get(mon.id)?.get(name),
      id: /^perish[0-3]$/.test(name) ? 'perishsong' : name }));
    const ownActive = mon.side === request.side?.id && mon.slot !== null ? request.active?.[mon.slot] : null;
    const enabled = ownActive?.moves.filter(move => !move.disabled && (move.pp === undefined || move.pp > 0)) ?? [];
    const disabled = ownActive?.moves.filter(move => move.disabled) ?? [];
    for (const effect of mon.simVolatiles) {
      if (effect.id === 'encore') {
        effect.moveId = mon.lastMoveId?.slice(5) ?? (enabled.length === 1 ? id(enabled[0]!.id) : undefined);
        effect.moveEvidence = mon.lastMoveId ? 'public-last-move' : enabled.length === 1 ? 'sole-enabled-own-request-move' : 'unknown';
      }
      if (effect.id === 'torment' && !mon.lastMoveId && disabled.length === 1) {
        effect.moveId = id(disabled[0]!.id); effect.moveEvidence = 'sole-disabled-own-request-move';
      }
    }
    if (ownActive?.moves.length === 1 && id(ownActive.moves[0]!.id) === 'recharge'
      && !mon.simVolatiles.some((effect: Value) => effect.id === 'mustrecharge')) {
      mon.simVolatiles.push({ id: 'mustrecharge', sinceTurn: turn });
    }
    const itemId = mon.item?.cardId?.slice(5);
    if (['choiceband', 'choicespecs', 'choicescarf'].includes(itemId)) {
      const move = choiceMove.get(mon.id) ?? (enabled.length === 1 && disabled.length ? id(enabled[0]!.id) : undefined);
      if (move) mon.simVolatiles.push({ id: 'choicelock', moveId: move, sinceTurn: turn,
        moveEvidence: choiceMove.has(mon.id) ? 'public-move-since-entry' : 'sole-enabled-own-request-move' });
    }
    const sleeping = sleep.get(mon.id);
    mon.simSleep = mon.status === 'slp' ? sleeping ?? { observedStart: false, attempts: 0, rest: false } : null;
    mon.simChoiceLockedMove = mon.simVolatiles.find((effect: Value) => effect.id === 'choicelock')?.moveId ?? null;
  }
  for (const [side, effects] of Object.entries(state.sideConditions) as [string, Value[]][]) {
    for (const effect of effects) effect.simLayers = sideLayers.get(`${side}:${simEffectId(effect.name)}`) ?? 1;
  }
}

export function validateObservedEffects(state: Value): string[] {
  const errors: string[] = [];
  for (const mon of state.pokemon as Value[]) {
    if (mon.fainted) continue;
    if (mon.status && !['slp', 'brn', 'psn', 'tox', 'par', 'frz'].includes(mon.status)) errors.push(`${mon.id}: unsupported status ${mon.status}.`);
    for (const effect of effectsFor(mon)) {
      if (!supported.has(effect.id)) errors.push(`${mon.id}: unsupported active effect ${effect.id}.`);
      if (['encore', 'disable', 'choicelock'].includes(effect.id) && !effect.moveId) errors.push(`${mon.id}: ${effect.id} move lacks public/request evidence.`);
    }
  }
  for (const effects of Object.values(state.sideConditions) as Value[][]) for (const effect of effects) {
    if (!supportedSides.has(simEffectId(effect.name))) errors.push(`Unsupported side condition ${effect.name}.`);
  }
  return errors;
}

/** Restore known effects without rerunning onStart and its already-observed damage. */
export function applyObservedEffects({ battle, state, mons = state.pokemon, actorById, endpoint, assumptions }: {
  battle: any; state: Value; mons?: Value[]; actorById: Record<string, any>; endpoint: 'low' | 'high'; assumptions: string[];
}): void {
  const choose = (low: number, high: number) => endpoint === 'low' ? low : high;
  const turn = state.request.turn as number;
  for (const mon of mons as Value[]) {
    const pokemon = actorById[mon.id]; if (!pokemon || mon.fainted) continue;
    if (mon.status === 'tox') {
      pokemon.statusState.stage = Number.isInteger(mon.simToxicStage) ? mon.simToxicStage : choose(0, 15);
      assumptions.push(`${mon.id}: toxic stage ${pokemon.statusState.stage} ${Number.isInteger(mon.simToxicStage) ? 'from visible ticks since entry/status' : 'sampled from unknown stage 0..15'}.`);
    }
    if (mon.status === 'slp') {
      const evidence = mon.simSleep ?? { observedStart: false, attempts: 0, rest: false };
      const step = pokemon.hasAbility('earlybird') ? 2 : 1;
      const spent = evidence.attempts * step;
      const minimum = evidence.observedStart ? Math.max(1, (evidence.rest ? 3 : 2) - spent) : 1;
      const maximum = evidence.observedStart ? Math.max(minimum, (evidence.rest ? 3 : 4) - spent) : 4;
      pokemon.statusState.time = choose(minimum, maximum); pokemon.statusState.startTime = pokemon.statusState.time + spent;
      assumptions.push(`${mon.id}: remaining sleep counter sampled ${pokemon.statusState.time} from ${minimum}..${maximum}; ${evidence.attempts} public sleep-blocked actions, no hidden timer read.`);
    }
    if (mon.protectChain) pokemon.volatiles.stall = battle.initEffectState({ id: 'stall', target: pokemon,
      duration: 1, counter: Math.min(729, 3 ** mon.protectChain) });
    for (const effect of effectsFor(mon)) {
      const name = effect.id as string;
      if (!supported.has(name)) throw new Error(`${mon.id}: unsupported volatile ${name}.`);
      const values: Value = { id: name, target: pokemon };
      const source = effect.sourceId ? actorById[effect.sourceId] : undefined;
      if (source) { values.source = source; values.sourceSlot = source.getSlot(); }
      if (singleTurns.has(name)) values.duration = 1;
      if (name === 'mustrecharge') values.duration = 2;
      if (name === 'perishsong') {
        if (!Number.isInteger(mon.simPerishDuration)) throw new Error(`${mon.id}: Perish Song lacks a public counter.`);
        values.duration = mon.simPerishDuration;
      }
      if (['disable', 'encore', 'taunt'].includes(name)) {
        const base = name === 'disable' ? 4 : 3;
        const elapsed = Math.max(0, turn - (effect.sinceTurn ?? turn));
        const minimum = Math.max(1, base - elapsed), maximum = Math.max(minimum, base + 1 - elapsed);
        values.duration = choose(minimum, maximum);
        assumptions.push(`${mon.id}: ${name} residual duration ${values.duration} sampled from ${minimum}..${maximum}; public start turn ${effect.sinceTurn}, hidden queue timing is unknown.`);
      }
      if (effect.moveId) values.move = effect.moveId;
      if (name === 'torment' && effect.moveId && !pokemon.lastMove) {
        pokemon.lastMove = battle.dex.getActiveMove(effect.moveId); pokemon.lastMoveUsed = pokemon.lastMove;
        assumptions.push(`${mon.id}: Torment previous move inferred as ${effect.moveId} from the sole disabled own request entry.`);
      }
      if (name === 'substitute') {
        const max = Math.max(1, Math.floor(pokemon.maxhp / 4));
        // The log discloses neither remaining HP nor prior direct mutations.
        values.hp = choose(1, max);
        assumptions.push(`${mon.id}: Substitute HP sampled ${values.hp} from 1..${max}; its exact remaining HP is not public.`);
      }
      if (name === 'leechseed' && !source) {
        const slots = pokemon.side.foe.active.map((foe: any) => foe.getSlot());
        values.sourceSlot = endpoint === 'low' ? slots[0] : slots.at(-1);
        assumptions.push(`${mon.id}: Leech Seed source slot is absent from the log; assuming ${values.sourceSlot}, sampling opposing slots only (not exhaustive source identities).`);
      }
      if (name === 'confusion') {
        values.time = choose(1, 5); assumptions.push(`${mon.id}: confusion counter ${values.time} sampled from unknown 1..5.`);
      }
      const target = ['wideguard', 'quickguard'].includes(name) ? pokemon.side : pokemon;
      values.target = target;
      const effectState = battle.initEffectState(values, effect.sequence);
      if (target === pokemon.side) target.sideConditions[name] = effectState;
      else pokemon.volatiles[name] = effectState;
    }
  }
  for (const [sideId, effects] of Object.entries(state.sideConditions) as [string, Value[]][]) {
    const side = battle[sideId];
    for (const effect of effects) {
      const name = simEffectId(effect.name);
      if (!supportedSides.has(name)) throw new Error(`Unsupported side condition ${name}.`);
      const values: Value = { id: name, target: side };
      if (['spikes', 'toxicspikes'].includes(name)) values.layers = Math.min(name === 'spikes' ? 3 : 2, effect.simLayers ?? 1);
      if (!['spikes', 'toxicspikes', 'stealthrock', 'stickyweb'].includes(name)) {
        const base = name === 'tailwind' ? 4 : ['wideguard', 'quickguard'].includes(name) ? 1 : 5;
        const extendable = ['reflect', 'lightscreen', 'auroraveil'].includes(name);
        const elapsed = Math.max(0, turn - (effect.sinceTurn ?? turn));
        const fixed = effect.simTimerEvidence?.duration;
        const low = Math.max(1, (fixed ?? base) - elapsed), high = Math.max(low, (fixed ?? (extendable ? 8 : base)) - elapsed);
        values.duration = choose(low, high);
        if (!fixed && low !== high) assumptions.push(`${sideId}: ${name} duration ${values.duration} sampled from ${low}..${high}; extender source is unknown.`);
      }
      side.sideConditions[name] = battle.initEffectState(values);
    }
  }
}

/** makeRequest alone does not run these endTurn hooks in the pinned engine. */
export function refreshObservedRestrictions(battle: any): void {
  for (const pokemon of battle.getAllActive()) {
    if (pokemon.fainted) continue;
    for (const slot of pokemon.moveSlots) { slot.disabled = false; slot.disabledSource = ''; }
    battle.runEvent('DisableMove', pokemon);
    for (const slot of pokemon.moveSlots) {
      const move = battle.dex.getActiveMove(slot.id);
      battle.singleEvent('DisableMove', move, null, pokemon);
      if (move.flags.cantusetwice && pokemon.lastMove?.id === slot.id) pokemon.disableMove(slot.id);
    }
    pokemon.trapped = false;
    battle.runEvent('TrapPokemon', pokemon);
  }
}
