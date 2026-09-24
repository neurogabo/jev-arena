import assert from 'node:assert/strict';
import type { SystemOneRequest } from '@typesafe-ai/sdk';
import { assertBudget } from '../context.js';
import type { Config } from '../schema.js';
import { SIM_VERSION, type ConsequenceReport, type SimObservation, type SimPosition, type SimBranch } from './types.js';

/** Accept only the observation channel; fixture labels and cached contexts are not inputs. */
export function extractPlayerLog(value: unknown): string[] {
  const object = value as { state?: { showdownLog?: unknown } } | null;
  const log = Array.isArray(value) ? value : object?.state?.showdownLog;
  assert.ok(Array.isArray(log) && log.length && log.every(line => typeof line === 'string'),
    'Input must be a nonempty player log array, or a request with state.showdownLog.');
  return [...log];
}

function dictionary(prefix: string) {
  const values: Record<string, unknown> = {};
  const ids = new Map<string, string>();
  return { values, add(value: unknown): string {
    const signature = JSON.stringify(value);
    let key = ids.get(signature);
    if (!key) { key = `${prefix}${ids.size + 1}`; ids.set(signature, key); values[key] = value; }
    return key;
  } };
}

function compactPosition(position: SimPosition, pokemonStates: ReturnType<typeof dictionary>) {
  return {
    // Keep every participant, including fainted reserves; these are hypothetical endpoints.
    pokemon: position.pokemon.map(p => pokemonStates.add([p.id, p.hpPercent, p.status, p.active, p.fainted, p.species, p.boosts])),
    weather: position.weather, terrain: position.terrain,
    pendingReplacement: position.pendingReplacement, battleEnded: position.battleEnded,
  };
}

/** Only public projections enter this packet. Internal hypothesis snapshots are never accepted. */
export function buildSimRequest(observation: SimObservation, report: ConsequenceReport, config: Config): SystemOneRequest {
  assert.equal(report.version, SIM_VERSION);
  assert.equal(report.observationKey, observation.input.key, 'Consequences belong to a different observation.');
  const candidates = observation.input.candidates;
  assert.deepEqual(report.actions.map(({ id, command, description }) => ({ id, command, description })), candidates,
    'Simulation must preserve the complete native action menu and its order.');
  assert.ok(candidates.length > 0 && candidates.length <= config.maxChoices, 'Native menu exceeds this prototype\'s single-Choice limit.');
  assert.ok(report.coverage.simulatedBranches > 0, 'No simulated consequences are available.');
  assert.equal(report.coverage.exhaustive, false);
  const pokemonStates = dictionary('pokemonState');
  const positions = dictionary('position');
  const events = dictionary('event');
  const outcomes = dictionary('outcome');
  const opponentResponses = dictionary('response');
  const actions = report.actions.map(action => {
    type Group = { hypothesis: string; opponentResponse: string; outcome?: string; error?: string; samples: number[];
      horizon?: SimBranch['horizon']; replacementTiming?: SimBranch['replacementTiming'] };
    const groups = new Map<string, Group>();
    for (const branch of action.branches) {
      let outcome: string | undefined;
      if (branch.status === 'simulated') {
        assert.ok(branch.position, 'Simulated branch lacks a public endpoint.');
        outcome = outcomes.add({ position: positions.add(compactPosition(branch.position, pokemonStates)),
          events: (branch.events ?? []).map(event => events.add(event)) });
      }
      const error = branch.status === 'error' ? 'Simulation could not resolve this branch; outcome is unknown.' : undefined;
      const response = opponentResponses.add(branch.opponentAction);
      const signature = JSON.stringify([branch.hypothesisId, response, outcome, error, branch.horizon, branch.replacementTiming]);
      let group = groups.get(signature);
      if (!group) {
        group = { hypothesis: branch.hypothesisId, opponentResponse: response, outcome, error, samples: [],
          horizon: branch.horizon, replacementTiming: branch.replacementTiming };
        groups.set(signature, group);
      }
      group.samples.push(branch.sample);
    }
    // Merge only identical opponent command/outcome/sample sets across hypotheses.
    // Every hypothesis and sample association is retained; no averaging or ranking.
    const common = new Map<string, Omit<Group, 'hypothesis'> & { hypotheses: string[] }>();
    for (const { hypothesis, ...group } of groups.values()) {
      const signature = JSON.stringify(group);
      const prior = common.get(signature);
      if (prior) prior.hypotheses.push(hypothesis);
      else common.set(signature, { ...group, hypotheses: [hypothesis] });
    }
    return { id: action.id, status: action.status, cases: [...common.values()], omittedBranches: action.omittedBranches, notes: action.notes };
  });
  const commonConditions = report.assumptions[0]?.conditions.filter(condition => report.assumptions.every(h => h.conditions.includes(condition))) ?? [];
  const state = {
    method: SIM_VERSION,
    interpretation: {
      objective: 'Choose the joint action that best advances winning the battle: faint all opposing participants while keeping at least one of ours able to battle.',
      observation: 'showdownLog is the authorized player observation. Only its request belongs to us. The opponent next action and future random results are unknown.',
      consequences: 'These are conditional simulations on explicitly hypothetical states, NOT observed future events, correct-answer labels or guaranteed outcomes.',
      uncertainty: 'Opponent statistics, counters or other missing details may be assumed. Read the assumptions and coverage limits. A sampled success does not prove success against every response. Unknown outcomes are not losses.',
      sampling: 'Sample counts and listed opponent responses are coverage bookkeeping, NOT opponent action probabilities or estimated chances of winning. Identical projected outcomes are losslessly grouped.',
      horizon: 'Ordinary-turn simulations stop at the next decision. For replacement-entry, only the selected switches and entry effects are simulated: a hidden continuation is NOT resolved. Read each case horizon and replacementTiming. Damage alone does not determine the best plan; positioning and preservation matter.',
      references: 'Look up actions[].cases[].opponentResponse in opponentResponses and outcome in outcomes. Each outcome points to positions and ordered public events. positions[].pokemon references pokemonStates using endpointColumns. Every listed hypothesis has the same listed samples for that case. Expand these references to read the complete conditional result; nothing is averaged.',
      endpointColumns: ['id', 'hpPercent', 'status', 'active', 'fainted', 'species', 'boosts'],
    },
    showdownLog: observation.log,
    actors: (observation.input.state.pokemon as { id: string; side: string; name: string }[]).map(p => ({ id: p.id, side: p.side, name: p.name })),
    assumptions: { commonConditions, hypotheses: report.assumptions.map(h => ({ id: h.id, conditions: h.conditions.filter(c => !commonConditions.includes(c)) })) },
    coverage: report.coverage,
    actions,
    outcomes: outcomes.values,
    opponentResponses: opponentResponses.values,
    pokemonStates: pokemonStates.values,
    positions: positions.values,
    events: events.values,
  };
  const request: SystemOneRequest = {
    model: config.model,
    state: JSON.parse(JSON.stringify(state)),
    questions: { selection: {
      type: 'choice',
      instructions: 'Select exactly one of the original legal joint actions. Use the player observation and conditional simulated consequences to pursue the battle objective. Account for untested responses and uncertain assumptions. Return your judgment; the simulator does not recommend an action.',
      criteria: Object.fromEntries(candidates.map(action => [action.id, action.description])),
    } },
  };
  assertBudget(request, config);
  return request;
}
