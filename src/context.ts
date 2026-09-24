import type { EntryType, Questions, SystemOneRequest } from '@typesafe-ai/sdk';
import { z } from 'zod';
import { buildJointActions, observedState } from './schema.js';
import type { Config, Scenario, JointAction } from './schema.js';
import { dependencyClosure, describeCandidate, modelCard, relevantRelations, seedIds, digest } from './wiki.js';
import type { Wiki } from './wiki.js';

// Round-trip strips undefined optional fields; inputs have already been schema-checked.
const entry = (value: unknown): EntryType => JSON.parse(JSON.stringify(value)) as EntryType;
const bytes = (value: unknown) => Buffer.byteLength(JSON.stringify(value), 'utf8');

export function measureRequest(request: SystemOneRequest) {
  const questionBytes = Object.values(request.questions).map(question => bytes(question));
  if (!questionBytes.length) throw new Error('A model request must contain questions.');
  return {
    stateBytes: bytes(request.state),
    largestQuestionBytes: Math.max(...questionBytes),
    stateAndLargestQuestionBytes: bytes(request.state) + Math.max(...questionBytes),
    requestBytes: bytes(request),
    // UTF-8 size is a local operational guard, not Jev's tokenizer or token count.
    unit: 'utf8-bytes-not-tokens',
  };
}

export function assertBudget(request: SystemOneRequest, config: Config) {
  const measured = measureRequest(request);
  if (measured.stateAndLargestQuestionBytes > config.maxStateAndQuestionBytes || measured.requestBytes > config.maxRequestBytes) {
    throw new Error(`Context exceeds the configured byte budget (${JSON.stringify(measured)}). Nothing was truncated. Review the context or change the budget with measured Jev token usage.`);
  }
  return measured;
}

const semantics = {
  unknown: 'null or an unknown item means unknown, never absent or zero.',
  moves: 'knownMoveIds describe disclosed or observed moves, not the full learnset. Only supplied joint actions can be selected.',
  rules: 'A supplied rule or conditional relationship is reference knowledge, not evidence that its trigger currently holds.',
  statistics: 'unmodifiedStats are actual battle stats before stages, when known. Species base stats are not actual stats. Apply stages only once.',
  history: 'These are player-visible facts. The opponent current commands and future random outcomes are not available.',
  hypothesis: 'Hypotheses are alternatives, not observed facts. Do not infer exact sets or stat allocations from a species name.',
  builds: 'Build candidates apply only to unknown opponent information. Revealed moves, items, abilities and forms override them; their ordering is not a usage probability. In revealed-demo, only Pokemon identity sections are included and missing trained stats remain unknown.',
};

export function prepare(scenario: Scenario, wiki: Wiki, config: Config) {
  if (scenario.formatId !== wiki.manifest.formatId) throw new Error('Scenario and wiki formats differ.');
  const actions = buildJointActions(scenario, config.maxChoices);
  const roots = seedIds(scenario, actions, config.coreCardIds);
  const pokemonDetail: 'identity' | 'full' = scenario.informationPolicy.mode === 'revealed-demo' ? 'identity' : 'full';
  const rootCards = roots.map(id => modelCard(wiki, id, pokemonDetail));
  const rootSet = new Set(roots);
  // Scan the compact mechanics/interaction index as well as graph neighbours.
  // Do not let a missing navigation edge exclude a whole mechanics family.
  const graphNeighbours = new Set(wiki.edges.filter(e => rootSet.has(e.from)).flatMap(e => [e.to, ...(e.interaction ? [e.interaction] : [])]));
  const candidates = wiki.index.filter(e => !rootSet.has(e.id) && (
    e.kind === 'mechanic' || e.kind === 'interaction' ||
    (graphNeighbours.has(e.id) && e.kind === 'project-guide')
  )).sort((a, b) => a.id.localeCompare(b.id)).map(candidate => describeCandidate(wiki, candidate));
  const questions: Questions = {};
  const questionToCard: Record<string, string> = {};
  candidates.forEach((candidate, i) => {
    const questionId = `relevance_${i}`;
    questionToCard[questionId] = candidate.id;
    questions[questionId] = {
      type: 'noul',
      instructions: `For candidate ${candidate.id} at candidates[${i}], does this exact battle decision need a rule described by that article? Establish relevance from battle facts, availableActionsByActor, explicitly labelled hypotheses, or effects directly caused by the known moves and active abilities. Use knownDefinitions only to interpret those entities. General examples in rule text and intrinsic alternative abilities are NOT available battle facts. In a revealed-demo, the listed four-move sets, item absence and lack of reserves or Mega options are exhaustive for this decision; unknown trained stats do not imply an unknown moveset. Do not select an article merely because it discusses a counter that could exist in a different team, field or game state.`,
      criteria: {
        true: 'At least one rule is directly used here: resolving a listed action or its target, an active effect, a secondary effect a known move can create, or a necessary dependency such as priority, damage, type immunity, grounding or current stat stages. A broad article qualifies if at least one of its rules actually applies.',
        false: 'No rule applies to the supplied position or known actions. Relevance would require inventing an unavailable move, unobserved ability, item despite confirmed absence, reserve, transformation, terrain or other unsupported effect. Mere topic similarity or an exception mentioning our species/type is insufficient.',
      },
    };
  });
  const retrievalRequest: SystemOneRequest = {
    model: config.model,
    state: entry({
      semantics, battle: observedState(scenario), knownDefinitions: rootCards,
      availableActionsByActor: scenario.actionMenus,
      actionCombinationRule: 'Choose one option per acting Pokemon. Partners act together; they cannot switch into the same reserve or declare two Mega Evolutions. Opponent responses remain unknown.',
      candidates,
      relationships: relevantRelations(wiki, [...roots, ...candidates.map(c => c.id)]),
    }),
    questions,
  };
  const retrievalSize = candidates.length ? assertBudget(retrievalRequest, config) : null;
  return {
    scenario, actions, roots, candidates, questionToCard, retrievalRequest, retrievalSize, pokemonDetail,
    fingerprint: digest(JSON.stringify({ battle: observedState(scenario), actions })),
    warnings: [
      ...(scenario.request.source === 'authored-fixture' ? ['Authored action menus have not been checked by the Showdown engine.'] : []),
      ...scenario.pokemon.filter(p => p.unmodifiedStats === null).map(p => `Actual stats are unknown for ${p.id}.`),
      'Retrieval threshold is an experimental inclusion policy, not a validated accuracy guarantee.',
      'Context byte limits are not exact model token limits.',
    ],
  };
}
export type Prepared = ReturnType<typeof prepare>;

// The exact command objects remain in the audit/action map. Readable Choice
// descriptions avoid serializing identical JSON keys for every combination.
export function describeJointAction(action: JointAction): string {
  return action.commands.map(({ actorId, command }) => {
    if (command.kind === 'switch') return `${actorId}: switch to ${command.reserveId}`;
    if (command.kind === 'pass') return `${actorId}: pass (no action)`;
    const target = command.target.kind === 'pokemon' ? command.target.pokemonId : command.target.kind;
    const mega = command.megaFormId ? `Mega evolve into ${command.megaFormId}, then ` : '';
    return `${actorId}: ${mega}${command.moveId} -> ${target}`;
  }).join('; ');
}

const unitInterval = z.number().min(0).max(1);
const usage = z.object({ input_tokens: z.number().int().nonnegative(), output_tokens: z.number().int().nonnegative() });
const retrievalResponse = z.object({
  model: z.string(), usage,
  answers: z.record(z.string(), z.object({ type: z.literal('noul'), noul: unitInterval })),
});

export function readRetrieval(prepared: Prepared, response: unknown, config: Config) {
  const parsed = retrievalResponse.parse(response);
  if (parsed.model !== config.model) throw new Error(`Unexpected retrieval model: ${parsed.model}`);
  const expected = Object.keys(prepared.questionToCard);
  if (Object.keys(parsed.answers).length !== expected.length || expected.some(id => !parsed.answers[id])) {
    throw new Error('Retrieval response does not contain exactly the requested answers.');
  }
  const judgments = expected.map(questionId => {
    const probability = parsed.answers[questionId]!.noul;
    return { cardId: prepared.questionToCard[questionId]!, probability, selected: probability >= config.retrievalThreshold };
  });
  return { ...parsed, judgments, selectedIds: judgments.filter(j => j.selected).map(j => j.cardId) };
}

export function assembleDecision(prepared: Prepared, wiki: Wiki, config: Config, selectedIds: string[]) {
  const candidateIds = new Set(prepared.candidates.map(c => c.id));
  if (selectedIds.some(id => !candidateIds.has(id))) throw new Error('Selection contains an unoffered article.');
  const closure = dependencyClosure(wiki, [...prepared.roots, ...selectedIds]);
  const definitions = closure.ids.map(id => modelCard(wiki, id, prepared.pokemonDetail));
  const criteria = Object.fromEntries(prepared.actions.map(action => [action.id, describeJointAction(action)]));
  const request: SystemOneRequest = {
    model: config.model,
    state: entry({
      semantics, battle: observedState(prepared.scenario), definitions,
      relationships: relevantRelations(wiki, closure.ids),
    }),
    questions: {
      joint_action: {
        type: 'choice',
        instructions: 'Select the supplied joint action that best improves our chance of winning the whole battle. Evaluate both controlled Pokémon together. Consider opponent responses supported by observations or explicitly labelled hypotheses, without knowing their current commands. Account for survival, action order, positioning, partner interactions, damage and remaining resources. Use supplied Champions rules and conditional exceptions. Do not treat an available action as guaranteed to succeed. Choose only an action for the supplied current request. Do not invent unknown stats, items, moves, or precise damage outcomes.',
        criteria,
      },
    },
  };
  return {
    request, size: assertBudget(request, config), includedIds: closure.ids,
    dependencyReasons: closure.reasons,
    inclusion: closure.ids.map(id => ({
      id,
      reasons: [
        ...(prepared.roots.includes(id) ? ['state-or-core'] : []),
        ...(selectedIds.includes(id) ? ['jev-retrieval'] : []),
        ...(closure.reasons[id] ? ['possible-required-context'] : []),
      ],
    })),
    excludedCandidateIds: prepared.candidates.filter(c => !closure.ids.includes(c.id)).map(c => c.id),
  };
}

const choiceResponse = z.object({
  model: z.string(), usage,
  answers: z.object({
    joint_action: z.object({
      type: z.literal('choice'), choice: z.string(), confidence: unitInterval,
      probabilities: z.record(z.string(), unitInterval),
    }),
  }).strict(),
});

export function readDecision(prepared: Prepared, response: unknown, config: Config) {
  const parsed = choiceResponse.parse(response);
  if (parsed.model !== config.model) throw new Error(`Unexpected decision model: ${parsed.model}`);
  const answer = parsed.answers.joint_action;
  const selected = prepared.actions.find(action => action.id === answer.choice);
  if (!selected) throw new Error('Model selected an action outside this request.');
  const offered = new Set(prepared.actions.map(a => a.id));
  if (Object.keys(answer.probabilities).length !== offered.size || Object.keys(answer.probabilities).some(id => !offered.has(id))) {
    throw new Error('Choice distribution does not match the offered actions.');
  }
  const total = Object.values(answer.probabilities).reduce((a, b) => a + b, 0);
  if (Math.abs(total - 1) > 0.01) throw new Error('Choice probabilities do not sum to one.');
  if (answer.probabilities[answer.choice]! + 1e-6 < Math.max(...Object.values(answer.probabilities))) {
    throw new Error('Choice is inconsistent with its returned probability distribution.');
  }
  return { ...parsed, selected, meaning: 'Choice probabilities and confidence are not win probabilities.' };
}
