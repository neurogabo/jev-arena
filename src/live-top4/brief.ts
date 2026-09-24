import assert from 'node:assert/strict';
import { SIM_VERSION, type ConsequenceReport, type SimBranch, type SimPosition } from '../sim-v1/types.js';

/** Oversized evidence is rejected, never silently trimmed into an apparently safe action. */
export const MAX_CONSEQUENCE_BRIEF_BYTES = 32_768;
type Presence = 'none' | 'some' | 'all';
type Range = [number, number];
type EndpointPokemon = SimPosition['pokemon'][number];
type PokemonSummary = {
  actor: string; hpPercent: Range; fainted: Presence; active: Presence; present: Presence;
  status: (string | null)[]; forms: string[]; boosts: Record<string, Range>;
};
type FieldSummary = {
  weather: (string | null)[]; terrain: (string | null)[];
  pendingReplacement: Presence; battleEnded: Presence;
};
type PublicEffect = string[];
type ResponseSummary = {
  opponentCommand: string; horizon: 'next-decision' | 'replacement-entry' | 'unknown';
  replacementTiming: 'end-turn' | 'interrupted-turn' | 'unknown' | null;
  hypotheses: string[]; resolved: number; failed: number;
  failedByHypothesis: Record<string, number>;
  pokemon: number[]; field: number | null;
  effects: { everyResolved: number[]; someResolved: number[] };
  faintedAtEndPatterns: string[][]; unprojectedEvents: number;
};

export type ConsequenceBrief = {
  schemaVersion: 1; method: 'conditional-consequence-brief';
  interpretation: {
    conditional: string; uncertainty: string; ranges: string; effects: string; horizon: string;
    references: string; detailedAssumptionsIncluded: false;
  };
  coverage: {
    hypothesisCount: number; plannedBranches: number; simulatedBranches: number;
    failedBranches: number; omittedBranches: number; exhaustive: false; limitations: string[];
  };
  actors: Record<string, { name: string; side: 'own' | 'opponent'; aliases?: string[] }>;
  pokemonStates: PokemonSummary[]; fields: FieldSummary[]; publicEffects: PublicEffect[];
  actions: { id: string; command: string; status: 'simulated' | 'partial' | 'unknown';
    omittedBranches: number; responses: ResponseSummary[] }[];
  warnings: string[];
};

const BOOSTS = ['atk', 'def', 'spa', 'spd', 'spe', 'accuracy', 'evasion'] as const;
const unique = <T>(values: T[]): T[] => [...new Set(values)];
const range = (values: number[]): Range => [Math.min(...values), Math.max(...values)];
function presence(count: number, total: number): Presence {
  return count === 0 ? 'none' : count === total ? 'all' : 'some';
}
function dictionary<T>() {
  const values: T[] = [];
  const keys = new Map<string, number>();
  return { values, add(value: T): number {
    const signature = JSON.stringify(value);
    const previous = keys.get(signature);
    if (previous !== undefined) return previous;
    const index = values.length; values.push(value); keys.set(signature, index); return index;
  } };
}
function text(value: unknown): string {
  assert.ok(typeof value === 'string' && value.length <= 512 && !/[\r\n\0]/.test(value), 'Malformed public text in consequence report.');
  return value;
}
function count(value: number): number {
  assert.ok(Number.isSafeInteger(value) && value >= 0, 'Malformed consequence coverage count.');
  return value;
}

/** Project public protocol fields by event kind. Health, requests and unknown payloads are never copied. */
function projectEvent(line: string): { effect?: PublicEffect; unprojected?: true } {
  const parts = line.split('|');
  if (parts[0] !== '') return { unprojected: true };
  const kind = parts[1] ?? '';
  const args = parts.slice(2);
  const token = (index: number): string => text(args[index] ?? '');
  // Public percentages already appear in endpoint ranges. Keep damage/healing causes without health numerators.
  const modifiers = (): string[] => args.filter(value => /^\[(?:from|of)\] /.test(value) || /^\[(?:eat|weaken|miss|notarget|still|block|upkeep)\]$/.test(value)).map(text);
  const effect = (...values: string[]): { effect: PublicEffect } => ({ effect: [kind.replace(/^-/, ''), ...values] });
  switch (kind) {
    case 'turn': return {};
    case 'move': return effect(token(0), token(1), token(2), ...modifiers());
    case 'switch': case 'drag': case 'replace':
      return effect(token(0), token(1).split(',')[0]!);
    case 'detailschange': case '-formechange':
      return effect(token(0), token(1).split(',')[0]!, ...modifiers());
    case '-damage': case '-heal': return effect(token(0), ...modifiers());
    case '-sethp': return effect(...args.filter((_, index) => index % 2 === 0 && !args[index]!.startsWith('[')).map(text), ...modifiers());
    case '-boost': case '-unboost': case '-setboost': {
      if (!(BOOSTS as readonly string[]).includes(token(1)) || !/^-?[0-6]$/.test(token(2))) return { unprojected: true };
      return effect(token(0), token(1), token(2));
    }
    case 'faint': case '-crit': case '-supereffective': case '-resisted': case '-immune':
    case '-ohko': case '-mustrecharge': case '-clearboost': case '-clearpositiveboost':
    case '-clearnegativeboost': case '-invertboost': case '-cureteam':
      return effect(token(0), ...modifiers());
    case '-clearallboost': return effect();
    case '-weather': return args.includes('[upkeep]') ? {} : effect(token(0), ...modifiers());
    case 'cant': case '-status': case '-curestatus': case '-ability': case '-item': case '-enditem':
    case '-singleturn': case '-singlemove': case '-sidestart': case '-sideend':
    case '-prepare': case '-transform': case '-terastallize': case '-hitcount':
    case '-miss': case '-fail': case '-notarget':
      return effect(token(0), token(1), ...(kind === 'cant' && args[2] && !args[2].startsWith('[') ? [token(2)] : []), ...modifiers());
    case '-start': case '-end': case '-activate':
      return effect(token(0), token(1), ...args.slice(2).filter(value => !value.startsWith('[')).map(text), ...modifiers());
    case '-block': return effect(token(0), token(1), token(2), token(3), ...modifiers());
    case '-swapboost': case '-copyboost':
      return effect(token(0), token(1), token(2));
    case '-fieldstart': case '-fieldend': return effect(token(0), ...modifiers());
    case '-mega': case '-primal': return effect(token(0), token(1), token(2));
    default: return { unprojected: true };
  }
}

function summarizePokemon(id: string, values: EndpointPokemon[], resolved: number): PokemonSummary {
  for (const pokemon of values) {
    assert.ok(Number.isFinite(pokemon.hpPercent) && pokemon.hpPercent >= 0 && pokemon.hpPercent <= 100,
      'Invalid public percentage in consequence endpoint.');
    assert.ok(!pokemon.fainted || pokemon.hpPercent === 0, 'Fainted consequence endpoint has nonzero HP.');
  }
  return {
    actor: id, hpPercent: range(values.map(p => p.hpPercent)),
    fainted: presence(values.filter(p => p.fainted).length, values.length),
    active: presence(values.filter(p => p.active).length, values.length), present: presence(values.length, resolved),
    status: unique(values.map(p => p.status === null ? null : text(p.status))),
    forms: unique(values.map(p => text(p.species))),
    boosts: Object.fromEntries(BOOSTS.flatMap(stat => {
      const amounts = values.map(p => p.boosts[stat] ?? 0);
      assert.ok(amounts.every(value => Number.isInteger(value) && value >= -6 && value <= 6), 'Invalid public boost.');
      return amounts.some(Boolean) ? [[stat, range(amounts)]] : [];
    })),
  };
}

/** Marginal public consequences, without ranking actions or interpreting sample frequency as likelihood. */
export function buildConsequenceBrief(report: ConsequenceReport): ConsequenceBrief {
  assert.equal(report.version, SIM_VERSION, 'Unsupported consequence report version.');
  assert.ok(report.actions.length <= 4, 'Consequence brief accepts at most four own actions; nothing was truncated.');
  assert.equal(unique(report.actions.map(action => action.id)).length, report.actions.length, 'Own action identities must be unique.');
  const hypothesisIds = unique(report.assumptions.map(hypothesis => text(hypothesis.id)));
  assert.ok(hypothesisIds.length <= 8, 'Consequence brief accepts at most eight hypotheses; nothing was truncated.');
  const pokemonStates = dictionary<PokemonSummary>();
  const fields = dictionary<FieldSummary>();
  const publicEffects = dictionary<PublicEffect>();
  const actors: ConsequenceBrief['actors'] = Object.create(null) as ConsequenceBrief['actors'];
  const warnings: string[] = [];
  let unprojectedTotal = 0;
  const actions: ConsequenceBrief['actions'] = report.actions.map(action => {
    const groups = new Map<string, SimBranch[]>();
    const keys = new Set<string>();
    const commandsByHypothesis = new Map<string, Set<string>>();
    const samplesByPair = new Map<string, Set<number>>();
    for (const branch of action.branches) {
      assert.ok(hypothesisIds.includes(branch.hypothesisId), 'Consequence branch references an undeclared hypothesis.');
      assert.ok(branch.status === 'simulated' || branch.status === 'error', 'Unknown simulation branch status.');
      text(branch.opponentAction); count(branch.sample);
      const key = JSON.stringify([branch.hypothesisId, branch.opponentAction, branch.sample]);
      assert.ok(!keys.has(key), 'Duplicate consequence branch would distort coverage.'); keys.add(key);
      const commands = commandsByHypothesis.get(branch.hypothesisId) ?? new Set<string>();
      commands.add(branch.opponentAction); commandsByHypothesis.set(branch.hypothesisId, commands);
      assert.ok(commands.size <= 4, 'Consequence brief accepts at most four responses per hypothesis; nothing was truncated.');
      const pair = JSON.stringify([branch.hypothesisId, branch.opponentAction]);
      const samples = samplesByPair.get(pair) ?? new Set<number>(); samples.add(branch.sample); samplesByPair.set(pair, samples);
      assert.ok(samples.size <= 2, 'Consequence brief accepts at most two random samples per response/hypothesis; nothing was truncated.');
      const groupKey = JSON.stringify([branch.opponentAction, branch.horizon ?? 'unknown', branch.replacementTiming ?? null]);
      const group = groups.get(groupKey) ?? []; group.push(branch); groups.set(groupKey, group);
    }
    const responses = [...groups.values()].map((branches): ResponseSummary => {
      const first = branches[0]!;
      const resolved = branches.filter(branch => branch.status === 'simulated');
      const byPokemon = new Map<string, EndpointPokemon[]>();
      const effects = new Map<number, number>();
      let unprojectedEvents = 0;
      for (const branch of resolved) {
        assert.ok(branch.position, 'Resolved consequence branch lacks a public endpoint.');
        assert.ok(branch.position.pokemon.length <= 12, 'Unexpected consequence roster size.');
        const seen = new Set<string>();
        for (const pokemon of branch.position.pokemon) {
          text(pokemon.id); text(pokemon.name);
          assert.ok(pokemon.side === 'own' || pokemon.side === 'opponent', 'Invalid public actor side.');
          assert.ok(!seen.has(pokemon.id), 'Duplicate actor in public endpoint.'); seen.add(pokemon.id);
          const previous = actors[pokemon.id];
          assert.ok(!previous || previous.side === pokemon.side, 'Public actor identity changed sides.');
          if (!previous) actors[pokemon.id] = { name: pokemon.name, side: pokemon.side };
          else if (previous.name !== pokemon.name) previous.aliases = unique([...(previous.aliases ?? []), pokemon.name]);
          const entries = byPokemon.get(pokemon.id) ?? []; entries.push(pokemon); byPokemon.set(pokemon.id, entries);
        }
        assert.ok((branch.events?.length ?? 0) <= 256, 'Unexpected event count; consequence brief was not truncated.');
        const branchEffects = new Set<number>();
        for (const line of branch.events ?? []) {
          const projected = projectEvent(line);
          if (projected.unprojected) unprojectedEvents++;
          if (projected.effect) branchEffects.add(publicEffects.add(projected.effect));
        }
        for (const key of branchEffects) effects.set(key, (effects.get(key) ?? 0) + 1);
      }
      const positions = resolved.map(branch => branch.position!);
      const faintedAtEndPatterns = unique(positions.map(position => JSON.stringify(position.pokemon.filter(p => p.fainted).map(p => p.id).sort())))
        .map(value => JSON.parse(value) as string[]);
      unprojectedTotal += unprojectedEvents;
      return {
        opponentCommand: first.opponentAction, horizon: first.horizon ?? 'unknown', replacementTiming: first.replacementTiming ?? null,
        hypotheses: unique(branches.map(branch => branch.hypothesisId)), resolved: resolved.length, failed: branches.length - resolved.length,
        failedByHypothesis: Object.fromEntries(unique(branches.filter(branch => branch.status === 'error').map(branch => branch.hypothesisId))
          .map(id => [id, branches.filter(branch => branch.status === 'error' && branch.hypothesisId === id).length])),
        pokemon: [...byPokemon].map(([id, values]) => pokemonStates.add(summarizePokemon(id, values, resolved.length))),
        field: positions.length ? fields.add({
          weather: unique(positions.map(position => position.weather === null ? null : text(position.weather))),
          terrain: unique(positions.map(position => position.terrain === null ? null : text(position.terrain))),
          pendingReplacement: presence(positions.filter(position => position.pendingReplacement).length, positions.length),
          battleEnded: presence(positions.filter(position => position.battleEnded).length, positions.length),
        }) : null,
        effects: { everyResolved: [...effects].filter(([, n]) => n === resolved.length).map(([id]) => id),
          someResolved: [...effects].filter(([, n]) => n !== resolved.length).map(([id]) => id) },
        faintedAtEndPatterns, unprojectedEvents,
      };
    });
    const failed = responses.reduce((total, response) => total + response.failed, 0);
    const simulated = responses.reduce((total, response) => total + response.resolved, 0);
    const omittedBranches = count(action.omittedBranches);
    if (failed) warnings.push(`${text(action.id)}: ${failed} failed branches have UNKNOWN outcomes, not safe or losing outcomes.`);
    if (omittedBranches) warnings.push(`${text(action.id)}: ${omittedBranches} planned branches were not simulated; their threats are unknown.`);
    if (!simulated) warnings.push(`${text(action.id)}: no resolved consequence is available.`);
    return { id: text(action.id), command: text(action.command), status: !simulated ? 'unknown' :
      failed || omittedBranches || action.status !== 'simulated' ? 'partial' : 'simulated', omittedBranches, responses };
  });
  if (unprojectedTotal) warnings.push(`${unprojectedTotal} unrecognized public event records were not projected; effects may be missing.`);
  const brief: ConsequenceBrief = {
    schemaVersion: 1, method: 'conditional-consequence-brief',
    interpretation: {
      conditional: 'Hypothetical consequences only, not future observations. Counts, none/some/all and everyResolved describe tested branches, NOT probabilities or guarantees. Failed and omitted branches remain UNKNOWN.',
      uncertainty: 'Up to four hypothetical opponent training profiles crossed with two correlated HP/timer endpoints; missing statistics/counters are assumptions, not observed facts. Detailed assumptions remain in the full audit report.',
      ranges: 'HP ranges are public percentages over resolved sampled endpoints, not exact opponent stats or exhaustive bounds. Ranges/effects are marginal and may not coexist. Actor states describe only endpoints where present; present=some means other resolved branches omit this actor, not a KO. Zero boosts are omitted.',
      effects: 'publicEffects tuples use public Showdown event names without the leading hyphen, followed by actor, move/item/effect and allowed source modifiers as applicable. They show occurrence, not order or multiplicity. Enditem means item lost; [eat] means consumed. Fainted-at-end patterns retain joint KO possibilities, including previously fainted actors.',
      horizon: 'next-decision stops at the next request; replacement-entry covers only switches/entry effects, never hidden pending attacks. Pending replacement is not a completed turn. Battle ended does not identify a winner.',
      references: 'pokemon and field contain zero-based indexes into pokemonStates and fields. Effect indexes point to publicEffects. Actors use stable IDs; effect actors retain public protocol names/slots.',
      detailedAssumptionsIncluded: false,
    },
    coverage: {
      hypothesisCount: count(report.coverage.hypothesisCount), plannedBranches: count(report.coverage.plannedBranches),
      simulatedBranches: count(report.coverage.simulatedBranches), failedBranches: count(report.coverage.failedBranches),
      omittedBranches: count(report.coverage.omittedBranches), exhaustive: false,
      limitations: report.coverage.limitations.map(text),
    },
    actors, pokemonStates: pokemonStates.values, fields: fields.values, publicEffects: publicEffects.values, actions, warnings,
  };
  assert.ok(Buffer.byteLength(JSON.stringify(brief), 'utf8') <= MAX_CONSEQUENCE_BRIEF_BYTES,
    'Consequence brief exceeds its byte budget; no threats were silently truncated. Use explicit fallback.');
  return brief;
}
