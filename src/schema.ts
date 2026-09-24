import { z } from 'zod';

const id = z.string().min(1);
const cardId = z.string().regex(/^(?:[CM]\d+|[a-z-]+:[a-z0-9-]+)$/);
const side = z.enum(['p1', 'p2']);
const stage = z.number().int().min(-6).max(6);
const stats = z.object({
  hp: z.number().int().positive(), atk: z.number().int().positive(),
  def: z.number().int().positive(), spa: z.number().int().positive(),
  spd: z.number().int().positive(), spe: z.number().int().positive(),
}).strict();
const effect = z.object({
  cardId, description: z.string(), remainingTurns: z.number().int().nonnegative().nullable(),
}).strict();
const pokemon = z.object({
  id, side, slot: z.enum(['a', 'b']).nullable(), speciesId: cardId,
  typeIds: z.array(cardId).min(1).max(3),
  abilityId: cardId.nullable(),
  item: z.discriminatedUnion('status', [
    z.object({ status: z.literal('unknown') }).strict(),
    z.object({ status: z.literal('none') }).strict(),
    z.object({ status: z.literal('known'), cardId, active: z.boolean() }).strict(),
  ]),
  level: z.number().int().min(1).max(100),
  hp: z.object({
    percent: z.number().min(0).max(100),
    exact: z.object({ current: z.number().int().nonnegative(), max: z.number().int().positive() }).strict().nullable(),
  }).strict(),
  unmodifiedStats: stats.nullable(),
  statStages: z.object({ atk: stage, def: stage, spa: stage, spd: stage, spe: stage, accuracy: stage, evasion: stage }).strict(),
  knownMoveIds: z.array(cardId).max(4),
  effects: z.array(effect),
  firstActionOpportunity: z.boolean(),
  protectChain: z.number().int().nonnegative(),
}).strict();

const target = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('pokemon'), pokemonId: id }).strict(),
  z.object({ kind: z.literal('self') }).strict(),
  z.object({ kind: z.literal('our-side') }).strict(),
  z.object({ kind: z.literal('automatic') }).strict(),
]);
export const CommandSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('move'), moveId: cardId, target, megaFormId: cardId.optional() }).strict(),
  z.object({ kind: z.literal('switch'), reserveId: id }).strict(),
  z.object({ kind: z.literal('pass') }).strict(),
]);

export const ScenarioSchema = z.object({
  schemaVersion: z.literal(1),
  name: id,
  fixtureNotes: z.array(z.string()),
  formatId: id,
  request: z.object({
    battleId: id, requestId: id, turn: z.number().int().positive(),
    phase: z.enum(['move', 'replacement']), ourSide: side,
    actingPokemonIds: z.array(id).min(1).max(2),
    source: z.enum(['authored-fixture', 'player-observation']),
  }).strict(),
  informationPolicy: z.object({
    mode: z.enum(['revealed-demo', 'observed-only']), description: z.string(),
  }).strict(),
  field: z.object({ effects: z.array(effect) }).strict(),
  pokemon: z.array(pokemon).min(1),
  observations: z.array(z.string()),
  hypotheses: z.array(z.object({ description: z.string(), cardIds: z.array(cardId) }).strict()),
  actionMenus: z.array(z.object({
    actorId: id, options: z.array(CommandSchema).min(1),
  }).strict()).min(1).max(2),
}).strict();

export const ConfigSchema = z.object({
  wikiPath: id, scenarioPath: id, outputPath: id,
  model: z.string().regex(/^jev-\d+\.\d+\.\d+$/),
  coreCardIds: z.array(cardId).min(1),
  retrievalThreshold: z.number().min(0).max(1),
  maxChoices: z.number().int().min(2).max(255),
  maxStateAndQuestionBytes: z.number().int().positive(),
  maxRequestBytes: z.number().int().positive(),
  timeoutMs: z.number().int().min(1000).max(60000),
}).strict();

export type Scenario = z.infer<typeof ScenarioSchema>;
export type Config = z.infer<typeof ConfigSchema>;
export type Command = z.infer<typeof CommandSchema>;
export type JointAction = { id: string; commands: { actorId: string; command: Command }[] };

export function validateScenario(value: unknown): Scenario {
  const scenario = ScenarioSchema.parse(value);
  const byId = new Map(scenario.pokemon.map(p => [p.id, p]));
  if (byId.size !== scenario.pokemon.length) throw new Error('Duplicate Pokémon identities.');
  const occupied = scenario.pokemon.filter(p => p.slot !== null).map(p => `${p.side}:${p.slot}`);
  if (new Set(occupied).size !== occupied.length) throw new Error('Duplicate active positions.');
  const actors = scenario.request.actingPokemonIds;
  if (new Set(actors).size !== actors.length) throw new Error('Duplicate acting Pokémon.');
  if (scenario.actionMenus.length !== actors.length || new Set(scenario.actionMenus.map(m => m.actorId)).size !== actors.length) {
    throw new Error('Action menus must match the acting Pokémon exactly.');
  }
  for (const p of scenario.pokemon) {
    if (p.hp.exact && p.hp.exact.current > p.hp.exact.max) throw new Error(`Invalid HP: ${p.id}`);
    if (p.unmodifiedStats && p.hp.exact && p.unmodifiedStats.hp !== p.hp.exact.max) throw new Error(`HP/stat mismatch: ${p.id}`);
  }
  for (const menu of scenario.actionMenus) {
    const actor = byId.get(menu.actorId);
    if (!actors.includes(menu.actorId) || !actor || actor.side !== scenario.request.ourSide || actor.slot === null) {
      throw new Error(`Invalid controlled actor: ${menu.actorId}`);
    }
    const distinct = new Set(menu.options.map(option => JSON.stringify(option)));
    if (distinct.size !== menu.options.length) throw new Error(`Duplicate menu option: ${menu.actorId}`);
    for (const option of menu.options) {
      if (option.kind === 'move') {
        if (scenario.request.phase !== 'move' || actor.hp.percent === 0 || !actor.knownMoveIds.includes(option.moveId)) {
          throw new Error(`Unavailable move for ${menu.actorId}: ${option.moveId}`);
        }
        if (option.target.kind === 'pokemon') {
          const recipient = byId.get(option.target.pokemonId);
          if (!recipient || recipient.slot === null || recipient.hp.percent === 0 || recipient.id === actor.id) {
            throw new Error(`Invalid move target for ${menu.actorId}`);
          }
        }
      }
      if (option.kind === 'switch') {
        const reserve = byId.get(option.reserveId);
        if (!reserve || reserve.side !== actor.side || reserve.slot !== null || reserve.hp.percent === 0) {
          throw new Error(`Unavailable reserve: ${option.reserveId}`);
        }
      }
    }
  }
  return scenario;
}

// Menus are supplied by the fixture/adapter. This does not prove move targeting,
// trapping, PP, Mega eligibility, or team legality against the battle engine.
export function buildJointActions(scenario: Scenario, maxChoices: number): JointAction[] {
  let combinations: JointAction['commands'][] = [[]];
  for (const actorId of scenario.request.actingPokemonIds) {
    const menu = scenario.actionMenus.find(m => m.actorId === actorId)!;
    const next: JointAction['commands'][] = [];
    for (const commands of combinations) for (const command of menu.options) {
      const joined = [...commands, { actorId, command }];
      const reserves = joined.flatMap(c => c.command.kind === 'switch' ? [c.command.reserveId] : []);
      const megas = joined.filter(c => c.command.kind === 'move' && c.command.megaFormId).length;
      if (new Set(reserves).size !== reserves.length || megas > 1) continue;
      next.push(joined);
      if (next.length > maxChoices) throw new Error(`Action space exceeds ${maxChoices}; no candidates were silently discarded. Narrow the explicit demo scope or implement evaluated preselection.`);
    }
    combinations = next;
  }
  if (!combinations.length) throw new Error('No compatible joint actions.');
  return combinations.map((commands, i) => ({ id: `action_${String(i + 1).padStart(3, '0')}`, commands }));
}

// Explicit projection: operational notes, source provenance, and future engine
// internals cannot be forwarded simply by spreading an input object.
export function observedState(scenario: Scenario) {
  return {
    request: {
      battleId: scenario.request.battleId, requestId: scenario.request.requestId,
      turn: scenario.request.turn, phase: scenario.request.phase,
      ourSide: scenario.request.ourSide, actingPokemonIds: scenario.request.actingPokemonIds,
    },
    formatId: scenario.formatId, informationPolicy: scenario.informationPolicy,
    field: scenario.field, pokemon: scenario.pokemon,
    observations: scenario.observations, hypotheses: scenario.hypotheses,
  };
}
