import type { RuntimeAction } from './types.js';

export type RequestPokemon = {
  ident: string; details: string; condition: string; active: boolean;
  stats?: Record<string, number>; moves?: string[]; baseAbility?: string; ability?: string;
  item?: string; commanding?: boolean; reviving?: boolean;
};
export type RequestMove = {
  move: string; id: string; pp?: number; maxpp?: number; target?: string; disabled?: boolean | string;
};
export type RequestActive = {
  moves: RequestMove[]; trapped?: boolean; maybeTrapped?: boolean; maybeDisabled?: boolean;
  canMegaEvo?: boolean; canMegaEvoX?: boolean; canMegaEvoY?: boolean;
};
export type BattleRequest = {
  rqid?: number; wait?: boolean; teamPreview?: boolean; maxChosenTeamSize?: number;
  forceSwitch?: boolean[]; active?: (RequestActive | null)[];
  side?: { id: string; name?: string; pokemon: RequestPokemon[] };
};
export type TargetPokemon = { id: string; name: string; slot: number; alive: boolean };
type Option = { command: string; description: string; reserve?: number; mega?: boolean; forcedPass?: boolean };
const fainted = (pokemon: RequestPokemon) => /(?:^0(?:\s|\/)|\bfnt\b)/.test(pokemon.condition);

/** Commands follow the pinned engine's target coordinates: foes +1/+2, allies -1/-2. */
export function buildTurnActions(request: BattleRequest, foes: TargetPokemon[], options: { neutralDescriptions?: boolean } = {}): RuntimeAction[] {
  if (request.wait || request.teamPreview || !request.side) return [];
  const roster = request.side.pokemon;
  const activeCount = request.forceSwitch?.length ?? request.active?.length ?? 0;
  if (!activeCount || activeCount > 2) throw new Error('The adapter supports one or two active positions.');
  const reserves = roster.map((pokemon, i) => ({ pokemon, index: i + 1 }))
    .filter(({ pokemon }) => !pokemon.active && !fainted(pokemon));
  const forcedCount = request.forceSwitch?.filter(Boolean).length ?? 0;
  const forcedPasses = Math.max(0, forcedCount - reserves.length);
  const menus: Option[][] = [];
  for (let slot = 0; slot < activeCount; slot++) {
    const actor = roster[slot];
    const actorName = actor?.ident.split(': ').slice(1).join(': ') || `position ${slot + 1}`;
    const switchOptions = (): Option[] => reserves.map(({ pokemon, index }) => ({
      command: `switch ${index}`, description: `${actorName}: switch to ${pokemon.ident.split(': ').slice(1).join(': ')}`,
      reserve: index,
    }));
    if (request.forceSwitch) {
      if (!request.forceSwitch[slot]) menus.push([{ command: 'pass', description: `${actorName}: ${options.neutralDescriptions ? 'pass' : 'no replacement requested'}` }]);
      else menus.push([...switchOptions(), ...(forcedPasses ? [{
        command: 'pass', description: `${actorName}: ${options.neutralDescriptions ? 'pass' : 'leave empty (not enough reserves)'}`, forcedPass: true,
      }] : [])]);
      continue;
    }
    const active = request.active?.[slot];
    if (!actor || fainted(actor) || actor.commanding) {
      menus.push([{ command: 'pass', description: `${actorName}: ${options.neutralDescriptions ? 'pass' : 'cannot act'}` }]);
      continue;
    }
    if (!active) throw new Error(`Missing active request for ${actorName}.`);
    const menu: Option[] = [];
    const transformations = ['', ...(active.canMegaEvo ? ['mega'] : []),
      ...(active.canMegaEvoX ? ['megax'] : []), ...(active.canMegaEvoY ? ['megay'] : [])];
    const enabled = active.moves.map((move, index) => ({ move, index: index + 1 }))
      .filter(({ move }) => !move.disabled && (move.pp === undefined || move.pp > 0));
    // Showdown normally substitutes Struggle itself; retain the legal fallback for all-disabled updated requests.
    if (!enabled.length) enabled.push({ move: { id: 'struggle', move: 'Struggle', target: 'randomNormal' }, index: 1 });
    for (const { move, index } of enabled) {
      const target = move.target ?? (move.id === 'recharge' ? 'self' : move.id === 'struggle' ? 'randomNormal' : undefined);
      // Pinned Pokemon.getMoves(lockedMove) emits only {move,id}; hard locks also emit trapped:true.
      // Side.chooseMove accepts no new target here and retains the engine's original target location.
      // Missing targets on ordinary request entries remain malformed, not an invitation to infer a target.
      if (!target && active.trapped === true && active.moves.length === 1 &&
          move.target === undefined && move.pp === undefined && move.maxpp === undefined && move.disabled === undefined &&
          !active.canMegaEvo && !active.canMegaEvoX && !active.canMegaEvoY) {
        menu.push({ command: `move ${index}`, description: `${actorName}: ${move.move} (locked continuation; engine retains target)` });
        continue;
      }
      if (!target) throw new Error(`Move target missing in request: ${move.id}.`);
      const targets: { location?: number; label: string }[] = [];
      if (['normal', 'any', 'adjacentFoe', 'adjacentAlly', 'adjacentAllyOrSelf'].includes(target)) {
        if (['normal', 'any', 'adjacentFoe'].includes(target)) {
          for (const foe of foes) targets.push({ location: foe.slot + 1, label: foe.alive || options.neutralDescriptions ? foe.name : `${foe.name} (fainted; engine retargets)` });
          // A request can precede its public switch messages; either opposing slot is a valid coordinate.
          if (!foes.length) for (let i = 0; i < activeCount; i++) {
            targets.push({ location: i + 1, label: `opposing position ${i + 1}` });
          }
        }
        if (['normal', 'any', 'adjacentAlly', 'adjacentAllyOrSelf'].includes(target)) {
          for (let i = 0; i < activeCount; i++) {
            const ally = roster[i];
            if (!ally || (i === slot && target !== 'adjacentAllyOrSelf')) continue;
            const label = ally.ident.split(': ').slice(1).join(': ');
            targets.push({ location: -(i + 1), label: fainted(ally) && !options.neutralDescriptions ? `${label} (fainted; move may fail or retarget self)` : label });
          }
        }
        // Targeting an empty adjacent ally is legal in Showdown (the move may fail), preserving request options.
        if (!targets.length && target === 'adjacentAlly') targets.push({ location: slot === 0 ? -2 : -1, label: 'empty allied position' });
      } else targets.push({ label: target });
      for (const recipient of targets) for (const transformation of transformations) {
        menu.push({
          command: `move ${index}${recipient.location === undefined ? '' : ` ${recipient.location}`}${transformation ? ` ${transformation}` : ''}`,
          description: `${actorName}: ${move.move} -> ${recipient.label}${transformation ? ` (${transformation})` : ''}`,
          mega: Boolean(transformation),
        });
      }
    }
    if (!active.trapped) menu.push(...switchOptions());
    if (!menu.length) throw new Error(`No legal choices described by the request for ${actorName}.`);
    menus.push(menu);
  }
  let combinations: Option[][] = [[]];
  for (const menu of menus) {
    combinations = combinations.flatMap(previous => menu.map(option => [...previous, option])).filter(options => {
      const switches = options.flatMap(option => option.reserve === undefined ? [] : [option.reserve]);
      return new Set(switches).size === switches.length && options.filter(option => option.mega).length <= 1;
    });
  }
  if (request.forceSwitch) combinations = combinations.filter(options => options.filter(option => option.forcedPass).length === forcedPasses);
  if (!combinations.length) throw new Error('No compatible joint commands for this request.');
  return combinations.map(options => {
    const command = options.map(option => option.command).join(', ');
    return { id: `action_${command.replace(/[^a-z0-9-]/gi, '_')}`, command, description: options.map(option => option.description).join('; ') };
  });
}

export function buildPreviewActions(members: { id: string; name: string }[], count = 4): RuntimeAction[] {
  if (members.length !== 6 || count !== 4) throw new Error('This pilot requires selecting four of six Pokémon.');
  const actions: RuntimeAction[] = [];
  const visit = (indices: number[]) => {
    if (indices.length === count) {
      const chosen = indices.map(i => members[i]!);
      const order = indices.map(i => i + 1).join('');
      actions.push({ id: `team_${order}`, command: `team ${order}`,
        description: `Leads: ${chosen[0]!.name} + ${chosen[1]!.name}; reserves in order: ${chosen[2]!.name}, ${chosen[3]!.name}` });
      return;
    }
    for (let i = 0; i < members.length; i++) if (!indices.includes(i)) visit([...indices, i]);
  };
  visit([]);
  return actions;
}
