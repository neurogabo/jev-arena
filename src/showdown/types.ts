export type StatBlock = { hp: number; atk: number; def: number; spa: number; spd: number; spe: number };
export type PlainSet = {
  name: string; species: string; ability: string; item: string; nature: string;
  moves: string[]; evs: StatBlock; level: number; gender?: string; shiny?: boolean;
};
export type TeamMember = {
  id: string; speciesId: string; name: string; types: string[]; stats: StatBlock; set: PlainSet;
  mega?: { speciesId: string; types: string[]; abilityId: string; stats: StatBlock };
};
export type TeamSheet = {
  label: string; sourceUrl: string; sets: PlainSet[]; packed: string; members: TeamMember[];
};
export type PracticeTeams = { human: TeamSheet; jev: TeamSheet };
export type RuntimeAction = { id: string; description: string; command: string };
export type DecisionInput = {
  phase: 'team-preview' | 'move' | 'replacement';
  state: Record<string, unknown>;
  requiredCardIds: string[];
  candidates: RuntimeAction[];
  key: string;
  // Transport identity stays outside model state in log-only mode.
  requestIdentity?: { battleId: string; ourSide: string; rqid?: number };
};
