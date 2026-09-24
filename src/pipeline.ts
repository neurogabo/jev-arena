import { performance } from 'node:perf_hooks';
import type { Config } from './schema.js';
import type { Wiki } from './wiki.js';
import type { Evaluator } from './jev.js';
import type { Prepared } from './context.js';
import { assembleDecision, readDecision, readRetrieval } from './context.js';

export type SaveArtifact = (name: string, value: unknown) => Promise<void>;

// Deliberately returns a recommendation only. No Showdown execution is hidden
// behind this function; a future adapter must check its live request identity.
export async function decide(
  prepared: Prepared, wiki: Wiki, config: Config, evaluator: Evaluator,
  save: SaveArtifact, assertCurrent: () => Promise<void>,
) {
  let selectedIds: string[] = [];
  let retrievalMs = 0;
  await assertCurrent();
  if (prepared.candidates.length) {
    const start = performance.now();
    const raw = await evaluator.evaluate(prepared.retrievalRequest);
    retrievalMs = performance.now() - start;
    await save('retrieval-response.json', raw);
    const retrieval = readRetrieval(prepared, raw, config);
    selectedIds = retrieval.selectedIds;
    await save('retrieval-selection.json', retrieval);
  }
  await assertCurrent();
  const assembled = assembleDecision(prepared, wiki, config, selectedIds);
  await save('decision-request.json', assembled.request);
  await save('context-selection.json', {
    inclusion: assembled.inclusion, excludedCandidateIds: assembled.excludedCandidateIds,
    dependencyReasons: assembled.dependencyReasons, size: assembled.size,
  });
  const start = performance.now();
  const raw = await evaluator.evaluate(assembled.request);
  const decisionMs = performance.now() - start;
  await save('decision-response.json', raw);
  await assertCurrent();
  const decision = readDecision(prepared, raw, config);
  const result = {
    status: 'recommendation-only-not-executed',
    request: prepared.scenario.request,
    inputFingerprint: prepared.fingerprint,
    retrievalMs, decisionMs,
    ...decision,
  };
  await save('recommendation.json', result);
  return result;
}
