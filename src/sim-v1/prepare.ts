import assert from 'node:assert/strict';
import { buildSimRequest } from './context.js';
import { simulateConsequences } from './simulate.js';
import type { HypothesisSet, SimObservation } from './types.js';
import type { Config } from '../schema.js';

/** Conservative UTF-8 guard, not the provider tokenizer. Original V4 config is untouched. */
export const simBudgetConfig = (config: Config): Config => ({ ...config,
  maxStateAndQuestionBytes: Math.min(config.maxStateAndQuestionBytes, 64000),
  maxRequestBytes: Math.min(config.maxRequestBytes, 90000),
});

/** Reduce equal per-action/per-hypothesis sampling quotas, never hypotheses or candidates. */
export async function prepareSimContext(observation: SimObservation, hypotheses: HypothesisSet, config: Config,
  options: { maxBranches: number; samples: number }) {
  const minimum = observation.input.candidates.length * hypotheses.hypotheses.length;
  assert.ok(minimum > 0 && options.maxBranches >= minimum,
    'Branch budget must permit at least one simulation for every original action and every hypothesis.');
  const attempts: { maxBranches: number; status: string; simulated: number }[] = [];
  let maxBranches = options.maxBranches;
  while (true) {
    const report = await simulateConsequences(observation, hypotheses, { ...options, maxBranches });
    assert.ok(report.actions.every(action => hypotheses.hypotheses.every(hypothesis => action.branches.some(branch =>
      branch.hypothesisId === hypothesis.id && branch.status === 'simulated'))),
    'At least one original action/hypothesis has no simulated branch; this case is not compatible.');
    try {
      const request = buildSimRequest(observation, report, config);
      attempts.push({ maxBranches, status: 'within-budget', simulated: report.coverage.simulatedBranches });
      return { report, request, preparation: { minimumBranches: minimum, attempts, effectiveMaxBranches: maxBranches,
        policy: 'Lossless factoring first; if oversized, halve the uniform branch budget down to one response/sample per action and hypothesis. No action, hypothesis, observation or rule is truncated.' } };
    } catch (error) {
      if (!(error instanceof Error) || !error.message.startsWith('Context exceeds the configured byte budget')) throw error;
      attempts.push({ maxBranches, status: 'too-large', simulated: report.coverage.simulatedBranches });
      if (maxBranches === minimum) throw error;
      maxBranches = Math.max(minimum, Math.floor(maxBranches / 2));
    }
  }
}
