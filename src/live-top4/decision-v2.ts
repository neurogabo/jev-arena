import assert from 'node:assert/strict';
import { assertBudget } from '../context.js';
import { simBudgetConfig } from '../sim-v1/prepare.js';
import type { ConsequenceReport } from '../sim-v1/types.js';
import { buildConsequenceBriefV2, type ConsequenceBriefV2 } from './brief-v2.js';
import { chooseTop4Decision } from './decision.js';

export const TOP4_SIM_BRIEF_V2_VERSION = 'V4_TOP4_SIM_BRIEF_V2' as const;
type Arguments = Parameters<typeof chooseTop4Decision>;
type Audit = Awaited<ReturnType<typeof chooseTop4Decision>>['audit'];
const wire = <T>(value: T): T => JSON.parse(JSON.stringify(value));

/** Preserve V1 selection/simulation and replace only its final evidence delivery.
 * The outer query receives the actual changed request, so its trace/hash agrees
 * with the provider input. No winner, ordering or decision is overridden here.
 */
export async function chooseTop4DecisionV2(observation: Arguments[0], v4Context: Arguments[1],
  extras: Arguments[2], deps: Arguments[3], query: Arguments[4]) {
  const config = simBudgetConfig(deps.config);
  let report: ConsequenceReport | undefined;
  let oldBrief: unknown;
  let brief: ConsequenceBriefV2 | undefined;
  let preparationFailed = false;
  let finalDelivery: 'v2' | 'no-sim' | undefined;
  const decorateAudit = (audit: Audit) => {
    const available = audit.simulation.status === 'available' && finalDelivery === 'v2';
    assert.ok(audit.simulation.status !== 'available' || available,
      'A successful simulated decision must have received the actual V2 brief.');
    return { ...audit,
      architecture: deps.hiddenSetSimulation
        ? 'V4 -> Jev own top four -> Jev ranks public wiki set hypotheses -> legal hypothetical rosters -> common opponent portfolios -> paired Showdown branches -> conditional brief V2 -> Jev final choice'
        : 'V4 -> Jev own top four -> deterministic diverse opponent portfolio -> paired Showdown branches -> deterministic brief V2 -> Jev final choice',
      briefDelivery: { version: TOP4_SIM_BRIEF_V2_VERSION, actual: available ? 'v2' as const : 'no-sim' as const,
        changedModelField: 'state.consequenceBrief', originalBriefArtifact: oldBrief === undefined ? null : 'consequence-brief-v1.json',
        preparationFailed, noSimulationPolicy: 'If complete V2 evidence cannot be prepared or compared, keep the original shortlisted actions and current V4/log/memory; simulation is explicitly unavailable.' },
      simulation: { ...audit.simulation, briefVersion: available ? 2 : null,
        briefBytes: available ? Buffer.byteLength(JSON.stringify(brief), 'utf8') : 0,
        reasons: [...audit.simulation.reasons, ...(preparationFailed
          ? ['Consequence brief V2 could not be prepared; no earlier brief was sent as a substitute.'] : [])] },
    };
  };
  const result = await chooseTop4Decision(observation, v4Context, extras, { ...deps,
    save: async (name, value) => {
      if (name === 'consequences.json') report = value as ConsequenceReport;
      if (name === 'consequence-brief.json') {
        oldBrief = wire(value);
        await deps.save('consequence-brief-v1.json', oldBrief);
        await deps.assertCurrent();
        try {
          assert.ok(report, 'Fresh public consequences are required for brief V2.');
          brief = wire(buildConsequenceBriefV2(report, observation));
        } catch {
          preparationFailed = true;
          await deps.save('brief-v2-preparation-error.json', { version: TOP4_SIM_BRIEF_V2_VERSION,
            stage: 'brief', privateErrorTextOmitted: true });
          throw new Error('Consequence brief V2 preparation failed.');
        }
        await deps.assertCurrent();
        await deps.save(name, brief);
      } else if (name === 'top4-audit.json') await deps.save(name, decorateAudit(value as Audit));
      else await deps.save(name, value);
    },
  }, async (label, request) => {
    await deps.assertCurrent();
    const state = request.state as Record<string, unknown>;
    const final = state.stage === 'final';
    if (final && state.consequenceBrief !== undefined) {
      assert.ok(brief, 'Final request requires a freshly prepared V2 brief.');
      assert.deepEqual(state.consequenceBrief, oldBrief, 'Original brief changed before V2 delivery.');
      const changed = structuredClone(request);
      (changed.state as Record<string, unknown>).consequenceBrief = brief;
      assertBudget(changed, config);
      const answer = await query(label, changed);
      await deps.assertCurrent();
      finalDelivery = 'v2';
      return answer;
    }
    const answer = await query(label, request);
    await deps.assertCurrent();
    if (final) finalDelivery = 'no-sim';
    return answer;
  });
  return { ...result, audit: decorateAudit(result.audit) };
}
