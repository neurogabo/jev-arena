import assert from 'node:assert/strict';
import { buildHiddenSetHypotheses } from '../hidden-sets/hypotheses.js';
import type { SystemOneRequest } from '@typesafe-ai/sdk';
import { assertBudget } from '../context.js';
import type { LiveContextExtras, LiveSimDependencies } from '../live-sim/decision.js';
import { chooseLiveTournament, isContextLimit, type LiveQuery } from '../live-sim/tournament.js';
import { buildSimHypotheses } from '../sim-v1/hypotheses.js';
import { simBudgetConfig } from '../sim-v1/prepare.js';
import { simulateConsequences } from '../sim-v1/simulate.js';
import type { ConsequenceReport, SimObservation } from '../sim-v1/types.js';
import { LOG_SELECTION_INSTRUCTION } from '../showdown/log-only.js';
import type { RuntimeAction } from '../showdown/types.js';
import { buildConsequenceBrief } from './brief.js';
import { buildOpponentPortfolio } from './opponents.js';
import { shortlistActions } from './shortlist.js';

export const TOP4_SIM_VERSION = 'V4_TOP4_SIM_BRIEF_V1' as const;
const wire = (value: unknown): SystemOneRequest['state'] => JSON.parse(JSON.stringify(value));

/** Preserve every public event and the current complete own request. Prior request
 * snapshots are superseded, not additional public events. Full logs remain in traces.
 */
export function projectDecisionLog(log: readonly string[]) {
  let currentRequest = -1;
  log.forEach((line, index) => { if (line.startsWith('|request|')) currentRequest = index; });
  const requestCount = log.filter(line => line.startsWith('|request|')).length;
  assert.ok(currentRequest >= 0, 'A current player request is required.');
  return { showdownLog: log.filter((line, index) => !line.startsWith('|request|') || index === currentRequest),
    observationProjection: { retainedOwnRequests: 1, supersededOwnRequests: requestCount - 1,
      policy: 'All authorized public events are retained in order. Only the newest complete own request is included; earlier own request snapshots were superseded. Canonical state, V4 and current memory were reconstructed from the complete original log, preserved in the observation trace.' } };
}

/** V4 -> own shortlist -> common opposing responses -> engine -> brief -> final Jev choice.
 * No pending live command, actual battle snapshot, evaluator key or future log is an input.
 */
export async function chooseTop4Decision(observation: SimObservation, v4Context: string,
  extras: LiveContextExtras, deps: Pick<LiveSimDependencies, 'config' | 'save' | 'assertCurrent' | 'maxBranches' | 'samples' | 'onStatus'> &
    Partial<Pick<LiveSimDependencies, 'knowledge' | 'hiddenSetSimulation'>>, query: LiveQuery) {
  const config = simBudgetConfig(deps.config);
  const common = {
    method: TOP4_SIM_VERSION, ...projectDecisionLog(observation.log), v4Context,
    observationPolicy: observation.input.state.informationPolicy,
    ...(observation.input.state.selectionDisclosure ? { selectionDisclosure: observation.input.state.selectionDisclosure } : {}),
    ...(extras.teamBrief === undefined ? {} : { teamBrief: extras.teamBrief }),
    ...(extras.battleMemory === undefined ? {} : { battleMemory: extras.battleMemory }),
  };
  const packet = (actions: RuntimeAction[], stage: string, extra: Record<string, unknown> = {}): SystemOneRequest => ({
    model: config.model, state: wire({ ...common, stage, ...extra }),
    questions: { selection: { type: 'choice', instructions: stage === 'shortlist'
      ? LOG_SELECTION_INSTRUCTION
      : 'Select the strongest offered joint action using the current observed position, V4 mechanics and the conditional consequence brief when available. The brief describes hypothetical responses, not known future events. Consider dangers under each response, missing coverage, survival and positioning. Sample counts are not win probabilities. The first-stage ranking is deliberately not supplied; reconsider all offered actions.',
    criteria: Object.fromEntries(actions.map(action => [action.id, action.description])) } },
  });
  await deps.assertCurrent();
  // Opponent hypotheses depend on public evidence and V4, never on our shortlist.
  // Overlap their independent API waits; keep the exact prompts and full coverage.
  const [shortlistWork, hypothesesWork] = await Promise.allSettled([
    shortlistActions(observation.input.candidates, config,
      actions => packet(actions, 'shortlist'), (name, request) => query(`shortlist-${name}`, request), 4),
    deps.hiddenSetSimulation && observation.audit.opponentInformation === 'revealed-only'
      ? buildHiddenSetHypotheses(observation, deps.knowledge!, config, v4Context, query)
      : buildSimHypotheses(observation, { unknownReserveHP: 'bounds' }),
  ]);
  if (shortlistWork.status === 'rejected') throw shortlistWork.reason;
  const shortlist = shortlistWork.value;
  await deps.assertCurrent();
  await deps.save('top4-shortlist.json', shortlist);
  // Preserve native menu order rather than leaking the first-stage probability rank.
  const selectedIds = new Set(shortlist.actions.map(action => action.id));
  const candidates = observation.input.candidates.filter(action => selectedIds.has(action.id));
  assert.equal(candidates.length, Math.min(4, observation.input.candidates.length), 'Shortlist must preserve four unique actions when available.');
  const narrowed: SimObservation = { ...observation, input: { ...observation.input, candidates } };
  const reasons: string[] = [];
  let report: ConsequenceReport | undefined;
  let brief: ReturnType<typeof buildConsequenceBrief> | undefined;
  let portfolio: Awaited<ReturnType<typeof buildOpponentPortfolio>>['audit'] | undefined;
  let preparationStage: 'hypotheses' | 'portfolio' | 'simulation' | 'brief' = 'hypotheses';
  try {
    if (hypothesesWork.status === 'rejected') throw hypothesesWork.reason;
    const hypotheses = hypothesesWork.value;
    await deps.assertCurrent();
    await deps.save('simulation-hypotheses-audit.json', { audit: hypotheses.audit, unsupported: hypotheses.unsupported,
      assumptions: hypotheses.hypotheses.map(({ id, assumptions }) => ({ id, assumptions })) });
    if (hypotheses.unsupported.length || !hypotheses.hypotheses.length) {
      reasons.push(...hypotheses.unsupported.length ? hypotheses.unsupported : ['No compatible hypotheses.']);
    } else {
      preparationStage = 'portfolio';
      const responses = await buildOpponentPortfolio(observation, hypotheses, 4);
      portfolio = responses.audit;
      await deps.save('opponent-portfolio.json', responses);
      const samples = deps.samples ?? 2;
      // The simulator uses equal quotas; differing replacement menus must each fit in full.
      const branches = candidates.length * hypotheses.hypotheses.length * Math.max(...Object.values(responses.commandsByHypothesis).map(commands => commands.length)) * samples;
      const ceiling = deps.maxBranches ?? 512;
      assert.ok(branches <= ceiling, 'Branch budget cannot fully cross the selected actions, responses, hypotheses and samples; simulation was not silently thinned.');
      await deps.assertCurrent();
      preparationStage = 'simulation';
      report = await simulateConsequences(narrowed, hypotheses, { maxBranches: branches, samples,
        opponentCommandsByHypothesis: responses.commandsByHypothesis });
      await deps.assertCurrent();
      // Failures stay visible in the brief rather than being interpreted as safe outcomes.
      if (!report.actions.every(action => action.branches.some(branch => branch.status === 'simulated'))) {
        reasons.push('At least one shortlisted action has no resolved branch. The final decision receives V4 without simulated evidence.');
        await deps.save('consequences-incomplete.json', report); report = undefined;
      } else {
        await deps.save('consequences.json', report);
        preparationStage = 'brief';
        brief = buildConsequenceBrief(report);
        await deps.save('consequence-brief.json', brief);
      }
    }
  } catch (error) {
    await deps.assertCurrent();
    // Engine errors could contain internal hypothetical snapshots; keep exported errors generic.
    reasons.push(`Conditional simulation preparation failed at ${preparationStage}; no private engine error text or incomplete evidence is sent to Jev.`);
    await deps.save('simulation-preparation-error.json', { stage: preparationStage,
      kind: isContextLimit(error) ? 'context-budget' : 'preparation-failed', privateErrorTextOmitted: true });
    report = undefined; brief = undefined;
  }
  const status = () => deps.onStatus?.(brief
    ? { type: 'simulation-ready', message: 'Jev is comparing up to four choices using simulated opponent responses.' }
    : { type: 'simulation-unavailable', reasons: [...reasons], message: 'Jev is reviewing its choices with V4 and the current state; simulation evidence is unavailable.' });
  await deps.assertCurrent();
  status();
  const finalPacket = (offered: RuntimeAction[]) => {
    const request = packet(offered, 'final', brief
      ? { consequenceBrief: brief, simulation: { status: 'available' } }
      : { simulation: { status: 'unavailable', reasons } });
    assertBudget(request, config); return request;
  };
  let decision: Awaited<ReturnType<typeof chooseLiveTournament>>;
  try {
    decision = await chooseLiveTournament(candidates, config, finalPacket,
      (name, request) => query(`final-${name}`, request));
  } catch (error) {
    if (!brief || !isContextLimit(error)) throw error;
    await deps.assertCurrent();
    reasons.push('The complete brief cannot fit the comparison budget. All shortlisted actions and the current V4/log/memory remain; simulation is explicitly unavailable.');
    brief = undefined; status();
    decision = await chooseLiveTournament(candidates, config, finalPacket,
      (name, request) => query(`final-no-sim-${name}`, request));
  }
  await deps.assertCurrent();
  const audit = {
    architecture: 'V4 -> Jev own top four -> deterministic diverse opponent portfolio -> paired Showdown branches -> deterministic brief -> Jev final choice',
    shortlist: shortlist.audit, shortlistedIds: candidates.map(action => action.id), opponentPortfolio: portfolio,
    simulation: { status: brief ? 'available' : 'unavailable', reasons, coverage: report?.coverage ?? null,
      briefBytes: brief ? Buffer.byteLength(JSON.stringify(brief)) : 0 },
    tournament: decision.audit,
    limitation: 'The final decision cannot recover an action omitted by the first-stage shortlist. Opponent coverage is a bounded deterministic portfolio, not a calibrated policy or exhaustive search.',
  };
  await deps.save('top4-audit.json', audit);
  return { selected: decision.selected, answer: decision.answer, audit };
}
