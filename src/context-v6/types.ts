import type { SystemOneRequest } from '@typesafe-ai/sdk';
import type { DecisionInput } from '../showdown/types.js';
import type { prepareDecisionFacts } from '../context-v5/facts.js';
import type { prepareMechanicalRelations } from '../context-v5/relations.js';

export type V6Evidence = {
  input: DecisionInput;
  showdownLog: string[];
  facts: ReturnType<typeof prepareDecisionFacts>;
  relations: ReturnType<typeof prepareMechanicalRelations>;
  state: SystemOneRequest['state'];
};
export type V6Query = (label: string, request: SystemOneRequest) => Promise<unknown>;
export type V6ChoiceAnswer = { type: 'choice'; choice: string; confidence: number; probabilities: Record<string, number> };
export type V6ScoreAnswer = { type: 'score'; score: number; confidence: number; probabilities: Record<string, number>; legend: Record<string, unknown> };
export type V6NoulAnswer = { type: 'noul'; noul: number };
export type V6Answer = V6ChoiceAnswer | V6ScoreAnswer | V6NoulAnswer;
export type V6Policy = {
  id: string;
  choiceId: string;
  actionDistribution?: Record<string, number>;
  actionScores?: Record<string, number>;
  valueMeaning: string;
  audit: Record<string, unknown>;
};
export type V6ArchitectureResult = { policies: V6Policy[]; audit: Record<string, unknown> };
