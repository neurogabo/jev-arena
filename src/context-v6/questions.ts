import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import type { SystemOneRequest } from '@typesafe-ai/sdk';
import { z } from 'zod';
import { assertBudget, measureRequest } from '../context.js';
import type { Config } from '../schema.js';
import type { V6Answer, V6Query } from './types.js';

const unit = z.number().finite().min(0).max(1);
const distribution = z.record(z.string(), unit);
const answerSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('choice'), choice: z.string(), confidence: unit, probabilities: distribution }),
  z.object({ type: z.literal('score'), score: z.number().finite(), confidence: unit, probabilities: distribution, legend: z.record(z.string(), z.unknown()) }),
  z.object({ type: z.literal('noul'), noul: unit }),
]);
export const V6_RESPONSE_POLICY = Object.freeze({ probabilitySumTolerance: 0.01,
  scorePrecision: 'Allow half a hundredth for the score plus half a hundredth per probability weighted by its level. Preserve original values.',
  normalization: 'none', questionsPerBatch: 24, identicalRequestRetries: 0 });
export const requestHash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function validateV6Response(request: SystemOneRequest, raw: unknown) {
  const response = z.object({ model: z.literal(request.model!),
    usage: z.object({ input_tokens: z.number().int().nonnegative(), output_tokens: z.number().int().nonnegative() }),
    answers: z.record(z.string(), answerSchema) }).parse(raw);
  assert.deepEqual(Object.keys(response.answers).sort(), Object.keys(request.questions).sort(), 'Response question keys changed.');
  for (const [id, question] of Object.entries(request.questions)) {
    const answer = response.answers[id]!;
    assert.equal(answer.type, question.type, 'Response question type changed.');
    if (question.type === 'noul') continue;
    assert.notEqual(answer.type, 'noul');
    if (answer.type === 'noul') throw new Error('Unreachable mismatched answer.');
    const keys = question.type === 'score' ? question.criteria.map((_, i) => String(i)) : Object.keys(question.criteria);
    assert.deepEqual(Object.keys(answer.probabilities).sort(), [...keys].sort(), 'Distribution must include every original criterion exactly once.');
    const sum = Object.values(answer.probabilities).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 1) <= V6_RESPONSE_POLICY.probabilitySumTolerance + Number.EPSILON * keys.length, 'Invalid distribution sum.');
    if (answer.type === 'choice') assert.ok(keys.includes(answer.choice), 'Unoffered explicit choice.');
    if (answer.type === 'score' && question.type === 'score') {
      const top = question.criteria.length - 1;
      assert.ok(top > 0 && answer.score >= 0 && answer.score <= top, 'Score outside rubric range.');
      assert.deepEqual(answer.legend, Object.fromEntries(question.criteria.map((level, i) => [String(i), level])), 'Score rubric changed.');
      const expected = Object.entries(answer.probabilities).reduce((s, [level, p]) => s + Number(level) * p, 0);
      const rounding = 0.005 + 0.005 * top * (top + 1) / 2 + Number.EPSILON * keys.length;
      assert.ok(Math.abs(answer.score - expected) <= rounding, 'Score is inconsistent with its original level distribution.');
    }
  }
  return response as { model: string; usage: { input_tokens: number; output_tokens: number }; answers: Record<string, V6Answer> };
}

/** Batch independent questions; split questions only, never evidence, criteria or candidates. */
export async function askAll(prefix: string, state: SystemOneRequest['state'], questions: SystemOneRequest['questions'], config: Config, query: V6Query) {
  const entries = Object.entries(structuredClone(questions));
  const evidence = structuredClone(state);
  const answers: Record<string, V6Answer> = {};
  const calls: { label: string; requestHash: string; questionCount: number; status: string }[] = [];
  for (const [, q] of entries) if (q.type === 'choice') assert.ok(Object.keys(q.criteria).length > 0 && Object.keys(q.criteria).length <= config.maxChoices);
  let offset = 0;
  while (offset < entries.length) {
    let count = Math.min(V6_RESPONSE_POLICY.questionsPerBatch, entries.length - offset);
    const makeRequest = (): SystemOneRequest => ({ model: config.model, state: evidence, questions: Object.fromEntries(entries.slice(offset, offset + count)) });
    while (count > 1) {
      const size = measureRequest(makeRequest());
      if (size.requestBytes <= config.maxRequestBytes && size.stateAndLargestQuestionBytes <= config.maxStateAndQuestionBytes) break;
      count = Math.ceil(count / 2);
    }
    let split = 0;
    while (true) {
      const request = makeRequest(); assertBudget(request, config);
      const label = `${prefix}-${offset}${split ? `-split-${split}` : ''}`;
      const call = { label, requestHash: requestHash(request), questionCount: count, status: 'requested' }; calls.push(call);
      let raw: unknown;
      try { raw = await query(label, structuredClone(request)); }
      catch (error) {
        const status = (error as { status?: unknown } | null)?.status;
        if (!(error instanceof Error) || !error.message.includes('max_tokens_exceeded') || !(status === 400 || /^400\b/.test(error.message)) || count === 1) throw error;
        call.status = 'size-rejected'; count = Math.ceil(count / 2); split++; continue;
      }
      const response = validateV6Response(request, raw);
      for (const [id, answer] of Object.entries(response.answers)) { assert.ok(!Object.hasOwn(answers, id)); answers[id] = answer; }
      call.status = 'ok'; offset += count; break;
    }
  }
  assert.deepEqual(Object.keys(answers).sort(), entries.map(([id]) => id).sort());
  return { answers, calls };
}
