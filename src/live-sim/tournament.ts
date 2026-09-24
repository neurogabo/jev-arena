import assert from 'node:assert/strict';
import type { SystemOneRequest } from '@typesafe-ai/sdk';
import { z } from 'zod';
import { assertBudget } from '../context.js';
import type { Config } from '../schema.js';
import type { RuntimeAction } from '../showdown/types.js';

export type LiveQuery = (label: string, request: SystemOneRequest) => Promise<unknown>;
const unit = z.number().finite().min(0).max(1);
export type LiveChoice = { choice: string; confidence: number; probabilities: Record<string, number> };
export class TournamentContextLimit extends Error {
  constructor() { super('Context cannot compare even two complete options; no action, rule or observation was truncated.'); }
}
export const isContextLimit = (error: unknown) => error instanceof Error &&
  (error instanceof TournamentContextLimit || error.message.startsWith('Context exceeds the configured byte budget') ||
    (/max_tokens_exceeded/.test(error.message) && ((error as Error & { status?: number }).status === 400 || /^400\b/.test(error.message))));

export function readChoice(raw: unknown, actions: RuntimeAction[], model: string): LiveChoice {
  const response = z.object({ model: z.literal(model), usage: z.object({ input_tokens: z.number().int().nonnegative(),
    output_tokens: z.number().int().nonnegative() }), answers: z.object({ selection: z.object({
    type: z.literal('choice'), choice: z.string(), confidence: unit, probabilities: z.record(z.string(), unit),
  }) }).strict() }).parse(raw);
  const answer = response.answers.selection;
  const ids = actions.map(action => action.id);
  assert.ok(ids.includes(answer.choice), 'Provider selected an unavailable action.');
  assert.deepEqual(Object.keys(answer.probabilities).sort(), [...ids].sort(), 'Provider probabilities differ from the offered action menu.');
  assert.ok(Math.abs(Object.values(answer.probabilities).reduce((a, b) => a + b, 0) - 1) <= 0.010000001,
    'Provider probabilities do not sum to one.');
  return answer;
}

/** Each original action is evaluated. Probabilities are ranked only within a question. */
export async function chooseLiveTournament(actions: RuntimeAction[], config: Config,
  makeRequest: (offered: RuntimeAction[]) => SystemOneRequest, query: LiveQuery) {
  assert.ok(actions.length && new Set(actions.map(action => action.id)).size === actions.length, 'Expected a unique nonempty action menu.');
  const limit = Math.min(120, 255, config.maxChoices);
  assert.ok(limit >= 2, 'Tournament requires at least two choices.');
  const rounds: { round: number; group: number; offeredIds: string[]; retainedIds: string[];
    providerChoice: string; probabilities: Record<string, number>; confidence: number; final: boolean }[] = [];
  const covered = new Set<string>();
  const carriedGroups: { round: number; group: number; actionId: string }[] = [];
  let pending = [...actions];
  for (let round = 0; ; round++) {
    const finalists: RuntimeAction[] = [];
    let groups = 0;
    for (let offset = 0; offset < pending.length; groups++) {
      let end = Math.min(pending.length, offset + limit);
      while (true) {
        const offered = pending.slice(offset, end);
        if (offered.length === 1 && pending.length > 1) {
          if (offset < pending.length - 1) throw new TournamentContextLimit();
          // A singleton cannot compare actions. Carry it without inventing a
          // model judgment; it must meet another option in a later round.
          finalists.push(offered[0]!);
          carriedGroups.push({ round, group: groups, actionId: offered[0]!.id });
          offset = end; break;
        }
        let raw: unknown;
        try {
          const request = makeRequest(offered);
          assertBudget(request, config);
          raw = await query(`decision-r${round}-g${groups}-n${offered.length}`, request);
        } catch (error) {
          if (!isContextLimit(error) || offered.length === 1) throw error;
          // Three oversized options may still permit a real pair comparison.
          end = offset + (offered.length === 3 ? 2 : Math.max(1, Math.floor(offered.length / 2)));
          continue;
        }
        const answer = readChoice(raw, offered, config.model);
        offered.forEach(action => covered.add(action.id));
        const final = offset === 0 && end === pending.length;
        const ranked = [...offered].sort((a, b) => answer.probabilities[b.id]! - answer.probabilities[a.id]!
          || a.id.localeCompare(b.id));
        // At tiny budget-induced groups retain fewer than the group size so
        // another round can make progress; singleton groups retain their one.
        const retained = final ? [offered.find(action => action.id === answer.choice)!]
          : ranked.slice(0, Math.max(1, Math.min(3, offered.length - 1)));
        rounds.push({ round, group: groups, offeredIds: offered.map(action => action.id),
          retainedIds: retained.map(action => action.id), providerChoice: answer.choice,
          probabilities: answer.probabilities, confidence: answer.confidence, final });
        if (final) {
          assert.equal(covered.size, actions.length, 'Tournament did not evaluate every original action.');
          return { selected: retained[0]!, answer, audit: { originalCount: actions.length, evaluatedIds: [...covered],
            rounds, carriedGroups, maxGroupSize: limit, probabilityScope: 'Each distribution compares only its offered group. Final probabilities cover finalists only, not the full original menu.' } };
        }
        finalists.push(...retained); offset = end; break;
      }
    }
    if (finalists.length >= pending.length) throw new TournamentContextLimit();
    pending = finalists;
  }
}
