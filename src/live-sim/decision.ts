import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import type { SystemOneRequest } from '@typesafe-ai/sdk';
import { assertBudget } from '../context.js';
import { buildFocusPackContexts } from '../context-v4/focus.js';
import type { DisclosedOpponentSelection } from '../context-v6/observation.js';
import type { ConciseKnowledge } from '../knowledge/concise.js';
import type { Evaluator } from '../jev.js';
import type { SaveArtifact } from '../pipeline.js';
import type { Config } from '../schema.js';
import { buildSimRequest } from '../sim-v1/context.js';
import { buildSimHypotheses } from '../sim-v1/hypotheses.js';
import { reconstructSimObservation } from '../sim-v1/observation.js';
import { simBudgetConfig } from '../sim-v1/prepare.js';
import { simulateConsequences } from '../sim-v1/simulate.js';
import type { ConsequenceReport, SimObservation } from '../sim-v1/types.js';
import { LogOnlyObserver, LOG_SELECTION_INSTRUCTION } from '../showdown/log-only.js';
import type { DecisionInput, RuntimeAction } from '../showdown/types.js';
import { chooseLiveTournament, isContextLimit, TournamentContextLimit, type LiveQuery } from './tournament.js';
import { isUnsupportedHistory, validateLiveDisclosure } from './observation.js';
import { chooseTop4Decision, TOP4_SIM_VERSION } from '../live-top4/decision.js';
import { chooseTop4DecisionV2, TOP4_SIM_BRIEF_V2_VERSION } from '../live-top4/decision-v2.js';

export const LIVE_SIM_VERSION = 'V4_PLUS_SIM_LIVE_V1' as const;
export type { DisclosedOpponentSelection };
export type LiveContextExtras = { teamBrief?: unknown; battleMemory?: unknown };
export type LiveSimDependencies = {
  config: Config; knowledge: ConciseKnowledge; evaluator: Evaluator; save: SaveArtifact;
  assertCurrent: () => Promise<void>; rosterDisclosure?: DisclosedOpponentSelection;
  augmentContext?: (input: DecisionInput, authorizedLog: string[], query: LiveQuery, save: SaveArtifact) => Promise<LiveContextExtras>;
  onStatus?: (event: { type: 'simulation-unavailable' | 'simulation-ready' | 'context-unavailable'; message: string; reasons?: string[] }) => void;
  maxBranches?: number; samples?: number;
  strategy?: 'top4' | 'top4-brief-v2';
  opponentInformation?: 'revealed-only';
  hiddenSetSimulation?: boolean;
};
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const wire = (value: unknown): SystemOneRequest['state'] => JSON.parse(JSON.stringify(value));
const briefError = (error: unknown) => error instanceof Error ? error.message : 'Unknown preparation error';

/** V4 still selects mechanics. Large menus are partitioned, never truncated. */
async function focusedContext(input: DecisionInput, deps: LiveSimDependencies, query: LiveQuery) {
  const one = async (actions: RuntimeAction[], label: string) => {
    const built = await buildFocusPackContexts({ ...input, candidates: actions }, deps.knowledge, deps.config,
      (name, request) => query(`${label}-${name}`, request), (name, value) => deps.save(`${label}-${name}`, value));
    return { capsule: built.conditions.find(c => c.id === 'V4B_CAPSULE')!.context,
      rules: built.conditions.find(c => c.id === 'V4B_RULES')!.context,
      context: built.conditions.find(c => c.id === 'V4B_FOCUS')!.context };
  };
  try { return (await one(input.candidates, 'v4')).context; }
  catch (error) {
    if (!isContextLimit(error)) throw error;
    await deps.save('v4-partition.json', { reason: 'Complete action universe exceeds one relevance question; select packs independently by deterministic groups and retain their union.' });
  }
  const texts = new Set<string>();
  let capsule = '';
  for (let offset = 0, group = 0; offset < input.candidates.length; group++) {
    let end = Math.min(input.candidates.length, offset + 120);
    while (true) {
      try {
        const built = await one(input.candidates.slice(offset, end), `v4-g${group}-n${end - offset}`);
        capsule = built.capsule; texts.add(built.rules); offset = end; break;
      } catch (error) {
        if (!isContextLimit(error) || end - offset <= 1) throw error;
        end = offset + Math.max(1, Math.floor((end - offset) / 2));
      }
    }
  }
  return [capsule, ...texts].join('\n\n');
}

function subsetReport(report: ConsequenceReport, actions: RuntimeAction[]): ConsequenceReport {
  const byId = new Map(report.actions.map(action => [action.id, action]));
  const chosen = actions.map(action => {
    const consequence = byId.get(action.id);
    assert.ok(consequence, 'Tournament action has no corresponding simulated consequences.');
    return consequence;
  });
  const branches = chosen.flatMap(action => action.branches);
  const omittedBranches = chosen.reduce((sum, action) => sum + action.omittedBranches, 0);
  return { ...report, actions: chosen, coverage: { ...report.coverage,
    plannedBranches: branches.length + omittedBranches, simulatedBranches: branches.filter(branch => branch.status === 'simulated').length,
    failedBranches: branches.filter(branch => branch.status === 'error').length, omittedBranches,
    limitations: [...report.coverage.limitations, 'This question contains only its tournament group. Every original legal action participates in the tournament; group probabilities are never compared across groups.'] } };
}

/** Fresh canonical input -> fresh V4 -> bounded conditional SIM -> Jev -> controller-owned send. */
export async function chooseLiveSimDecision(input: DecisionInput, authorizedLog: string[], deps: LiveSimDependencies) {
  const started = performance.now();
  const version = deps.hiddenSetSimulation ? 'V4_TOP4_WIKI_HYPOTHESES_V1' : deps.strategy === 'top4-brief-v2' ? TOP4_SIM_BRIEF_V2_VERSION
    : deps.strategy === 'top4' ? TOP4_SIM_VERSION : LIVE_SIM_VERSION;
  await deps.assertCurrent();
  const identity = input.requestIdentity ?? input.state.request as { battleId?: string; ourSide?: string; rqid?: number };
  assert.ok(identity && (identity.ourSide === 'p1' || identity.ourSide === 'p2'), 'Live decision requires a controlled player identity.');
  const observer = new LogOnlyObserver({ ourSide: identity.ourSide, battleId: identity.battleId });
  observer.receive(authorizedLog.join('\n'));
  assert.deepEqual(observer.showdownLog, authorizedLog, 'Live bridge accepts the authorized filtered log only.');
  const baseline = observer.decision();
  assert.ok(baseline, 'The player log is not actionable.');
  assert.equal(input.phase, baseline.phase, 'Controller phase is stale.');
  assert.deepEqual(input.candidates, baseline.candidates, 'Controller menu differs from the current own request.');
  assert.equal(identity.rqid, baseline.requestIdentity?.rqid, 'Controller rqid is stale.');
  if (deps.opponentInformation === 'revealed-only') {
    assert.equal(deps.rosterDisclosure, undefined, 'Closed information policy forbids selected-four disclosure.');
    const foe = identity.ourSide === 'p1' ? 'p2' : 'p1';
    assert.ok(!authorizedLog.some(line => line.startsWith(`|showteam|${foe}|`) || line.startsWith('|jevselection|')),
      'Closed information policy forbids opponent sheets and selected-four disclosures.');
  }
  const disclosed = deps.opponentInformation === 'revealed-only' ? undefined
    : await validateLiveDisclosure(authorizedLog, identity.ourSide, identity.battleId, deps.rosterDisclosure);
  let observation: SimObservation | undefined;
  let unsupportedHistory: string | undefined;
  try {
    observation = await reconstructSimObservation(authorizedLog, { ourSide: identity.ourSide,
      battleId: identity.battleId, disclosedOpponentSelection: deps.rosterDisclosure, opponentInformation: deps.opponentInformation });
  } catch (error) {
    if (!isUnsupportedHistory(error)) throw error;
    unsupportedHistory = briefError(error);
  }
  await deps.assertCurrent();
  const usage = { input_tokens: 0, output_tokens: 0 };
  const calls: { label: string; requestHash: string; elapsedMs: number; startedAfterMs: number; finishedAfterMs: number; usage?: unknown }[] = [];
  const query: LiveQuery = async (label, request) => {
    assertBudget(request, deps.config);
    await deps.assertCurrent();
    await deps.save(`${label}-request.json`, request);
    const at = performance.now();
    const raw = await deps.evaluator.evaluate(structuredClone(request));
    await deps.save(`${label}-response.json`, raw);
    await deps.assertCurrent();
    const used = (raw as { usage?: { input_tokens?: number; output_tokens?: number } } | null)?.usage;
    if (used && Number.isInteger(used.input_tokens) && Number.isInteger(used.output_tokens)) {
      usage.input_tokens += used.input_tokens!; usage.output_tokens += used.output_tokens!;
    }
    const finished = performance.now();
    calls.push({ label, requestHash: hash(request), elapsedMs: finished - at,
      startedAfterMs: at - started, finishedAfterMs: finished - started, usage: used });
    return raw;
  };
  if (!observation) {
    const reason = unsupportedHistory!;
    deps.onStatus?.({ type: 'context-unavailable', reasons: [reason],
      message: 'An observed transformation cannot yet be reconstructed. Jev will use the current log and legal actions; context and simulation are unavailable for this decision.' });
    const makeRequest = (actions: RuntimeAction[]): SystemOneRequest => ({ model: deps.config.model,
      state: wire({ method: LIVE_SIM_VERSION, showdownLog: authorizedLog,
        ...(disclosed ? { selectionDisclosure: disclosed } : {}),
        contextAvailability: { v4: 'unavailable', simulation: 'unavailable', dynamicBrief: 'unavailable', reason,
          policy: 'Use the authorized current log directly. No previous structured position, team resources, simulation, recommendation or predicted outcome is being reused.' } }),
      questions: { selection: { type: 'choice', instructions: LOG_SELECTION_INSTRUCTION,
        criteria: Object.fromEntries(actions.map(action => [action.id, action.description])) } } });
    const decision = await chooseLiveTournament(baseline.candidates, deps.config, makeRequest, query);
    await deps.assertCurrent();
    const audit = { version, controllerKey: input.key, canonicalKey: null,
      logHash: hash(authorizedLog), phase: baseline.phase, simulation: { status: 'unavailable', reasons: [reason], coverage: null },
      contextAvailability: 'raw-authorized-log-only', tournament: decision.audit, usage, calls, elapsedMs: performance.now() - started };
    await deps.save('live-sim-audit.json', audit);
    await deps.save('recommendation.json', { ...decision.selected, probabilities: decision.answer.probabilities,
      confidence: decision.answer.confidence, executed: false, probabilityScope: decision.audit.probabilityScope,
      simulationStatus: 'unavailable', contextAvailability: 'raw-authorized-log-only', usage });
    return { selected: decision.selected, probabilities: decision.answer.probabilities, confidence: decision.answer.confidence, audit };
  }
  const canonical = observation.input;
  await deps.save('canonical-observation.json', { input: canonical, audit: observation.audit,
    boundary: deps.opponentInformation === 'revealed-only'
      ? 'Own requests and public events only. No opponent sheet, selected-four disclosure, catalog data or live Battle object.'
      : 'Built from the authorized player stream and separately authorized unordered selection only. No live Battle object or private opponent stats.' });
  // These judgments use the same fresh observation, not one another's answers.
  // Drain both tasks on failure so a stale decision cannot leave background calls.
  const preparation = await Promise.allSettled([
    deps.augmentContext ? deps.augmentContext(canonical, observation.log, query, deps.save) : Promise.resolve({}),
    focusedContext(canonical, deps, query),
  ]);
  for (const result of preparation) if (result.status === 'rejected') throw result.reason;
  const extras = (preparation[0] as PromiseFulfilledResult<LiveContextExtras>).value;
  const v4Context = (preparation[1] as PromiseFulfilledResult<string>).value;
  await deps.save('v4-context.json', v4Context);
  await deps.assertCurrent();
  if ((deps.strategy === 'top4' || deps.strategy === 'top4-brief-v2') && canonical.phase !== 'team-preview') {
    const chooseStaged = deps.strategy === 'top4-brief-v2' ? chooseTop4DecisionV2 : chooseTop4Decision;
    const staged = await chooseStaged(observation, v4Context, extras, deps, query);
    await deps.assertCurrent();
    const audit = { version, controllerKey: input.key, canonicalKey: canonical.key,
      logHash: hash(observation.log), phase: canonical.phase, ...staged.audit,
      usage, calls, elapsedMs: performance.now() - started };
    await deps.save('live-sim-audit.json', audit);
    await deps.save('recommendation.json', { ...staged.selected, probabilities: staged.answer.probabilities,
      confidence: staged.answer.confidence, executed: false,
      probabilityScope: staged.audit.tournament.probabilityScope,
      simulationStatus: staged.audit.simulation.status, usage });
    return { selected: staged.selected, probabilities: staged.answer.probabilities,
      confidence: staged.answer.confidence, audit };
  }
  let report: ConsequenceReport | undefined;
  const reasons: string[] = [];
  if (canonical.phase === 'team-preview') reasons.push('Team Preview selects participants and order; one-turn simulation is not defined before the players choose their leads.');
  else {
    try {
      const hypotheses = await buildSimHypotheses(observation, { unknownReserveHP: 'bounds' });
      // Do not serialize the internal snapshots or seeds into any model artifact.
      await deps.save('simulation-hypotheses-audit.json', { audit: hypotheses.audit, unsupported: hypotheses.unsupported,
        assumptions: hypotheses.hypotheses.map(({ id, assumptions }) => ({ id, assumptions })) });
      if (hypotheses.unsupported.length || !hypotheses.hypotheses.length) reasons.push(...hypotheses.unsupported.length ? hypotheses.unsupported : ['No compatible hypotheses.']);
      else {
        await deps.assertCurrent();
        const minimum = canonical.candidates.length * hypotheses.hypotheses.length;
        report = await simulateConsequences(observation, hypotheses,
          { maxBranches: Math.max(minimum, deps.maxBranches ?? 512), samples: deps.samples ?? 2 });
        await deps.assertCurrent();
        if (!report.actions.every(action => hypotheses.hypotheses.every(h => action.branches.some(branch => branch.hypothesisId === h.id && branch.status === 'simulated')))) {
          reasons.push('At least one legal action or declared hypothesis lacks a successful simulated branch.'); report = undefined;
        }
      }
    } catch (error) {
      await deps.assertCurrent(); // A stale observation must never become a fallback decision.
      reasons.push(briefError(error)); report = undefined;
    }
  }
  const setStatus = () => deps.onStatus?.(report
    ? { type: 'simulation-ready', message: 'Jev is using V4, team memory and conditional simulations.' }
    : { type: 'simulation-unavailable', reasons: [...reasons], message: canonical.phase === 'team-preview'
      ? 'Jev is choosing its team with V4 and the team brief.'
      : 'Simulation is unavailable for this observation. Jev is using V4, the current log and battle memory.' });
  setStatus();
  if (report) await deps.save('consequences.json', report);
  const config = simBudgetConfig(deps.config);
  const makeRequest = (actions: RuntimeAction[]): SystemOneRequest => {
    const packet = report ? buildSimRequest({ ...observation, input: { ...canonical, candidates: actions } }, subsetReport(report, actions), config)
      : { model: config.model, state: wire({ method: LIVE_SIM_VERSION, showdownLog: observation.log,
        simulation: { status: 'unavailable', reasons }, observationPolicy: canonical.state.informationPolicy }),
        questions: { selection: { type: 'choice' as const, instructions: LOG_SELECTION_INSTRUCTION,
          criteria: Object.fromEntries(actions.map(action => [action.id, action.description])) } } };
    packet.state = wire({ ...packet.state as Record<string, unknown>,
      ...(canonical.state.selectionDisclosure ? { selectionDisclosure: canonical.state.selectionDisclosure } : {}),
      v4Context, ...(extras.teamBrief === undefined ? {} : { teamBrief: extras.teamBrief }),
      ...(extras.battleMemory === undefined ? {} : { battleMemory: extras.battleMemory }) });
    assertBudget(packet, config);
    return packet;
  };
  // Check irreducible per-action packets before any action selection request.
  if (report) {
    try { for (const action of canonical.candidates) makeRequest([action]); }
    catch (error) {
      if (!isContextLimit(error)) throw error;
      reasons.push('Complete conditional simulation plus V4/brief/log exceeds the budget even for one action. No observed information or candidate was truncated.');
      report = undefined; setStatus();
    }
  }
  let decision: Awaited<ReturnType<typeof chooseLiveTournament>>;
  try { decision = await chooseLiveTournament(canonical.candidates, config, makeRequest, query); }
  catch (error) {
    if (!report || !isContextLimit(error)) throw error;
    await deps.assertCurrent();
    reasons.push((error instanceof TournamentContextLimit
      ? 'Complete simulated options fit individually but cannot be compared together under the context budget. '
      : 'Provider context limit prevented even one complete simulated option. ')
      + 'Restarting the complete action tournament with V4/log/memory and no simulation, without truncating candidates.');
    await deps.save('simulation-context-limit.json', { reason: reasons.at(-1), previousCalls: calls.map(call => call.label) });
    report = undefined; setStatus();
    decision = await chooseLiveTournament(canonical.candidates, config, makeRequest,
      (label, request) => query(`no-sim-${label}`, request));
  }
  await deps.assertCurrent();
  const audit = { version, controllerKey: input.key, canonicalKey: canonical.key,
    logHash: hash(observation.log), phase: canonical.phase, simulation: { status: report ? 'available' : 'unavailable', reasons,
      coverage: report?.coverage ?? null }, tournament: decision.audit, usage, calls, elapsedMs: performance.now() - started };
  await deps.save('live-sim-audit.json', audit);
  await deps.save('recommendation.json', { ...decision.selected, probabilities: decision.answer.probabilities,
    confidence: decision.answer.confidence, executed: false, probabilityScope: decision.audit.probabilityScope,
    simulationStatus: audit.simulation.status, usage });
  return { selected: decision.selected, probabilities: decision.answer.probabilities,
    confidence: decision.answer.confidence, audit };
}
