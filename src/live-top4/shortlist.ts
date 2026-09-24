import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import type { SystemOneRequest } from '@typesafe-ai/sdk';
import { assertBudget } from '../context.js';
import { isContextLimit, readChoice, TournamentContextLimit, type LiveChoice, type LiveQuery } from '../live-sim/tournament.js';
import type { Config } from '../schema.js';
import type { RuntimeAction } from '../showdown/types.js';

type Stage = { stage: 'shortlist' | 'winner'; winnerIndex: number | null; round: number; group: number };
export type ShortlistRound = Stage & {
  label: string; requestHash: string; offeredIds: string[]; retainedIds: string[];
  providerChoice: string; confidence: number; probabilities: Record<string, number>; final: boolean;
};
export type ShortlistDistribution = {
  offeredIds: string[]; providerChoice: string; confidence: number; probabilities: Record<string, number>;
};
export type ShortlistAudit = {
  requestedCount: number; retainedCount: number; originalCount: number; evaluatedIds: string[];
  mode: 'single-choice' | 'grouped-top-k' | 'repeated-winner'; maxGroupSize: number;
  rounds: ShortlistRound[];
  carriedGroups: (Stage & { actionId: string })[];
  contextLimits: (Stage & { offeredIds: string[]; nextSize: number; origin: 'local-budget' | 'provider' })[];
  finalDistribution: ShortlistDistribution | null;
  probabilityScope: string;
};
export type ActionShortlist = { actions: RuntimeAction[]; audit: ShortlistAudit };

const compareIds = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const ranked = (actions: RuntimeAction[], answer: LiveChoice) => [...actions].sort((a, b) =>
  answer.probabilities[b.id]! - answer.probabilities[a.id]! || compareIds(a.id, b.id));

/**
 * Rank only within a single Choice distribution. Large menus retain four per
 * group before comparing the pool. When groups cannot shrink while retaining
 * four, repeat winner tournaments over the entire remaining pool: a loss in one
 * tournament cannot remove a candidate from subsequent shortlist positions.
 * This is a bounded grouped approximation, not a global probability estimate.
 */
export async function shortlistActions(actions: RuntimeAction[], config: Config,
  makeRequest: (offered: RuntimeAction[]) => SystemOneRequest, query: LiveQuery, count = 4): Promise<ActionShortlist> {
  assert.ok(Number.isInteger(count) && count >= 1 && count <= 4, 'Shortlist count must be an integer from one to four.');
  assert.ok(actions.length && new Set(actions.map(action => action.id)).size === actions.length,
    'Expected a unique nonempty action menu.');
  assert.ok(actions.every(action => typeof action.id === 'string' && action.id.length > 0 &&
    typeof action.command === 'string' && typeof action.description === 'string'), 'Invalid action.');
  const originals = structuredClone(actions);
  const limit = Math.min(255, config.maxChoices);
  assert.ok(Number.isInteger(limit) && limit >= 2, 'Shortlist requires a choice limit of at least two.');
  const wanted = Math.min(count, originals.length);
  const covered = new Set<string>();
  const rounds: ShortlistRound[] = [];
  const carriedGroups: ShortlistAudit['carriedGroups'] = [];
  const contextLimits: ShortlistAudit['contextLimits'] = [];
  let attempts = 0;
  // A rejected size may still work for other action descriptions. Start each
  // group at the configured limit instead of silently imposing a global cut.
  const compare = async (pending: RuntimeAction[], offset: number, stage: Stage) => {
    let size = Math.min(limit, pending.length - offset);
    if (size === 1 && pending.length > 1) return null;
    for (;;) {
      const offered = pending.slice(offset, offset + size);
      const label = `shortlist-${stage.stage}-w${stage.winnerIndex ?? 'na'}-r${stage.round}-g${stage.group}-a${attempts++}-n${size}`;
      let raw: unknown;
      let requestHash = '';
      let origin: 'local-budget' | 'provider' = 'local-budget';
      try {
        // Protect the caller's menu even when the request builder mutates its
        // argument. Commands and descriptions are copied exactly on return.
        const request = makeRequest(structuredClone(offered));
        assert.equal(request.model, config.model, 'Shortlist request model differs from the pinned model.');
        assert.deepEqual(Object.keys(request.questions), ['selection'], 'Shortlist expects exactly one selection question.');
        const question = request.questions.selection;
        assert.ok(question && question.type === 'choice', 'Shortlist requires a Choice question.');
        assert.deepEqual(Object.keys(question.criteria), offered.map(action => action.id), 'Shortlist request differs from the offered menu.');
        assert.deepEqual(question.criteria, Object.fromEntries(offered.map(action => [action.id, action.description])),
          'Shortlist request changed an action description.');
        assertBudget(request, config);
        requestHash = createHash('sha256').update(JSON.stringify(request)).digest('hex');
        origin = 'provider';
        raw = await query(label, request);
      } catch (error) {
        if (!isContextLimit(error)) throw error;
        if (size <= 2) throw new TournamentContextLimit();
        const nextSize = size === 3 ? 2 : Math.floor(size / 2);
        contextLimits.push({ ...stage, offeredIds: offered.map(action => action.id), nextSize, origin });
        size = nextSize;
        continue;
      }
      // Invalid replies never become size retries or invented distributions.
      const answer = readChoice(raw, offered, config.model);
      for (const action of offered) covered.add(action.id);
      return { offered, answer, ordered: ranked(offered, answer), label, requestHash };
    }
  };
  type Comparison = NonNullable<Awaited<ReturnType<typeof compare>>>;
  const record = (comparison: Comparison, retained: RuntimeAction[], stage: Stage, final: boolean) => {
    const { offered, answer, label, requestHash } = comparison;
    rounds.push({ ...stage, label, requestHash, offeredIds: offered.map(action => action.id),
      retainedIds: retained.map(action => action.id), providerChoice: answer.choice, confidence: answer.confidence,
      probabilities: { ...answer.probabilities }, final });
  };
  const finish = (selected: RuntimeAction[], mode: ShortlistAudit['mode'], comparison: Comparison | null): ActionShortlist => {
    assert.equal(selected.length, wanted, 'Shortlist lost a requested candidate.');
    assert.equal(new Set(selected.map(action => action.id)).size, wanted, 'Shortlist contains duplicate candidates.');
    assert.equal(covered.size, originals.length, 'Shortlist did not evaluate every original action.');
    return { actions: structuredClone(selected), audit: {
      requestedCount: count, retainedCount: wanted, originalCount: originals.length,
      evaluatedIds: originals.filter(action => covered.has(action.id)).map(action => action.id),
      mode, maxGroupSize: limit, rounds, carriedGroups, contextLimits,
      finalDistribution: comparison ? { offeredIds: comparison.offered.map(action => action.id),
        providerChoice: comparison.answer.choice, confidence: comparison.answer.confidence,
        probabilities: { ...comparison.answer.probabilities } } : null,
      probabilityScope: 'Each distribution compares only its offeredIds. Rank by probability within that question only; ties use ascending action ID. Grouped shortlist and repeated winners are approximations, not globally calibrated ranks. No cross-group probabilities are compared or combined. finalDistribution is null when there was no common final comparison.',
    } };
  };
  const repeatWinners = async (pool: RuntimeAction[]) => {
    const selected: RuntimeAction[] = [];
    let remaining = [...pool];
    for (let winnerIndex = 0; winnerIndex < wanted; winnerIndex++) {
      let pending = [...remaining];
      // Every winner tournament starts over with all unselected candidates,
      // including those that lost earlier winner tournaments.
      for (let round = 0; pending.length > 1; round++) {
        const finalists: RuntimeAction[] = [];
        for (let offset = 0, group = 0; offset < pending.length; group++) {
          const stage: Stage = { stage: 'winner', winnerIndex, round, group };
          const comparison = await compare(pending, offset, stage);
          if (!comparison) {
            finalists.push(pending[offset]!);
            carriedGroups.push({ ...stage, actionId: pending[offset]!.id });
            offset++;
            continue;
          }
          const retained = [comparison.ordered[0]!];
          record(comparison, retained, stage, offset === 0 && comparison.offered.length === pending.length);
          finalists.push(...retained);
          offset += comparison.offered.length;
        }
        assert.ok(finalists.length < pending.length, 'Winner tournament failed to reduce its candidates.');
        pending = finalists;
      }
      const winner = pending[0]!;
      selected.push(winner);
      remaining = remaining.filter(action => action.id !== winner.id);
    }
    return finish(selected, 'repeated-winner', null);
  };
  let pending = [...originals];
  for (let round = 0; ; round++) {
    const finalists: RuntimeAction[] = [];
    for (let offset = 0, group = 0; offset < pending.length; group++) {
      const stage: Stage = { stage: 'shortlist', winnerIndex: null, round, group };
      const comparison = await compare(pending, offset, stage);
      if (!comparison) {
        finalists.push(pending[offset]!);
        carriedGroups.push({ ...stage, actionId: pending[offset]!.id });
        offset++;
        continue;
      }
      const final = offset === 0 && comparison.offered.length === pending.length;
      // Even when count < 4, preserve four per intermediate group.
      const retained = comparison.ordered.slice(0, final ? wanted : 4);
      record(comparison, retained, stage, final);
      if (final) return finish(retained, round === 0 ? 'single-choice' : 'grouped-top-k', comparison);
      finalists.push(...retained);
      offset += comparison.offered.length;
    }
    if (finalists.length === pending.length) return repeatWinners(pending);
    assert.ok(finalists.length >= wanted && finalists.length < pending.length, 'Shortlist reduction lost candidates or failed to progress.');
    pending = finalists;
  }
}
