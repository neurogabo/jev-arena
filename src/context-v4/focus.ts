import { createHash } from 'node:crypto';
import type { SystemOneRequest } from '@typesafe-ai/sdk';
import { z } from 'zod';
import { assertBudget } from '../context.js';
import type { Config } from '../schema.js';
import type { SaveArtifact } from '../pipeline.js';
import type { ConciseKnowledge } from '../knowledge/concise.js';
import type { DecisionInput } from '../showdown/types.js';
import { buildPositionCapsule } from './capsule.js';
import { prepareFocusPacks } from './packs.js';

export const FOCUS_PACK_VARIANTS = Object.freeze([
  { id: 'V4B_CAPSULE', description: 'Minimal current-position capsule, without added mechanics.' },
  { id: 'V4B_RULES', description: 'Only the mechanical focus pack explicitly selected by Jev.' },
  { id: 'V4B_FOCUS', description: 'Minimal position and the mechanical focus pack explicitly selected by Jev.' },
  { id: 'V4B_FOCUS2', description: 'Minimal position, the selected pack and the highest-probability remaining pack.' },
  { id: 'V4B_ALL', description: 'Minimal position and every offered focus pack, without information selection.' },
]);
export const FOCUS_PACK_POLICY = Object.freeze({ selection: 'Explicit provider choice first; for two packs add the highest-probability remaining pack.',
  objective: 'Select useful mechanical information, never an action. No battle simulation or answer-key access.',
  relationToPhaseA: 'Tests a smaller position and focused definitions instead of mandatory inclusion of every intrinsic definition.' });
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const unit = z.number().min(0).max(1);

export async function buildFocusPackContexts(input: DecisionInput, knowledge: ConciseKnowledge, config: Config,
  query: (label: string, request: SystemOneRequest) => Promise<unknown>, save: SaveArtifact) {
  const snapshot = structuredClone(input);
  const capsule = buildPositionCapsule(snapshot, knowledge);
  const prepared = prepareFocusPacks(snapshot, knowledge);
  const packs = prepared.packs;
  if (!packs.length || packs.length > Math.min(255, config.maxChoices) || new Set(packs.map(p => p.id)).size !== packs.length) {
    throw new Error('Focus selection requires unique, nonempty focus packs within the Choice limit.');
  }
  const request: SystemOneRequest = { model: config.model,
    state: JSON.parse(JSON.stringify({ currentPosition: capsule.text,
      availableActions: snapshot.candidates.map(({ id, description }) => ({ id, description })),
      explanations: packs.map(({ id, text }) => ({ id, text })) })),
    questions: { focus: { type: 'choice',
      instructions: 'Which explanation would most help distinguish the consequences of the available actions in this current position? Select the most useful mechanical comparison for deciding how to win this battle. Select information, not an action.',
      criteria: Object.fromEntries(packs.map(p => [p.id, p.description])) } } };
  assertBudget(request, config);
  const raw = await query('focus-selector', request);
  const response = z.object({ model: z.literal(config.model),
    usage: z.object({ input_tokens: z.number().int().nonnegative(), output_tokens: z.number().int().nonnegative() }),
    answers: z.object({ focus: z.object({ type: z.literal('choice'), choice: z.string(), confidence: unit,
      probabilities: z.record(z.string(), unit) }) }).strict() }).parse(raw);
  const answer = response.answers.focus;
  const byId = new Map(packs.map(p => [p.id, p]));
  const keys = Object.keys(answer.probabilities);
  if (!byId.has(answer.choice) || keys.length !== packs.length || keys.some(id => !byId.has(id))) throw new Error('Focus distribution or choice does not match the offered packs.');
  if (Math.abs(Object.values(answer.probabilities).reduce((sum, p) => sum + p, 0) - 1) > 0.010000001) throw new Error('Focus probabilities do not sum to one.');
  const rest = packs.filter(p => p.id !== answer.choice).sort((a, b) => answer.probabilities[b.id]! - answer.probabilities[a.id]! || a.id.localeCompare(b.id));
  const selected = [byId.get(answer.choice)!, ...rest.slice(0, 1)];
  const join = (items: typeof packs) => [...new Set(items.map(p => p.text))].join('\n\n');
  const one = selected[0]!.text;
  const content = [capsule.text, one, `${capsule.text}\n\n${one}`, `${capsule.text}\n\n${join(selected)}`, `${capsule.text}\n\n${join(packs)}`];
  const conditions = FOCUS_PACK_VARIANTS.map((variant, index) => ({ id: variant.id, context: content[index]!, provenance: variant.description }));
  const audit = { policy: FOCUS_PACK_POLICY, requestHash: hash(request), inputHash: hash(snapshot),
    capsule: capsule.audit, preparation: prepared.audit, selection: answer, selectedIds: selected.map(p => p.id),
    packs: packs.map(p => ({ id: p.id, sourceIds: p.sourceIds, hash: hash(p.text), bytes: Buffer.byteLength(p.text) })),
    contexts: conditions.map(c => ({ id: c.id, hash: hash(c.context), bytes: Buffer.byteLength(JSON.stringify(c.context)) })) };
  await save('focus-contexts.json', { conditions, audit });
  return { conditions, audit };
}
