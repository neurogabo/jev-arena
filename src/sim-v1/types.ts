import type { BattleRequest } from '../showdown/actions.js';
import type { DecisionInput, RuntimeAction } from '../showdown/types.js';

export const SIM_VERSION = 'JEV_SIM_V2' as const;
export type SimObservation = {
  input: DecisionInput;
  request: BattleRequest;
  log: string[];
  audit: Record<string, unknown>;
};
/** Internal hypothetical state. Never pass snapshot or seed to Jev. */
export type SimHypothesis = {
  id: string;
  assumptions: string[];
  snapshot: string;
  actorIds: Record<string, string>;
  roster?: { id: string; name: string; side: 'own' | 'opponent'; initiallyFainted: boolean }[];
};
export type HypothesisSet = {
  hypotheses: SimHypothesis[];
  unsupported: string[];
  coverage: string;
  audit: Record<string, unknown>;
  inference?: Record<string, unknown>;
};
export type SimPosition = {
  pokemon: { id: string; side: 'own' | 'opponent'; name: string; active: boolean;
    fainted: boolean; hpPercent: number; status: string | null; species: string;
    boosts: Record<string, number> }[];
  weather: string | null;
  terrain: string | null;
  pendingReplacement: boolean;
  battleEnded: boolean;
};
export type SimBranch = {
  hypothesisId: string;
  opponentAction: string;
  sample: number;
  status: 'simulated' | 'error';
  horizon?: 'next-decision' | 'replacement-entry';
  replacementTiming?: 'end-turn' | 'interrupted-turn' | 'unknown';
  position?: SimPosition;
  events?: string[];
  error?: string;
};
export type ActionConsequence = RuntimeAction & {
  status: 'simulated' | 'partial' | 'unknown';
  branches: SimBranch[];
  omittedBranches: number;
  notes: string[];
};
export type ConsequenceReport = {
  version: typeof SIM_VERSION;
  observationKey: string;
  inference?: Record<string, unknown>;
  hypothesisRosters?: Record<string, NonNullable<SimHypothesis['roster']>>;
  assumptions: { id: string; conditions: string[] }[];
  coverage: { hypothesisCount: number; plannedBranches: number; simulatedBranches: number;
    failedBranches: number; omittedBranches: number; exhaustive: false; limitations: string[] };
  actions: ActionConsequence[];
};
