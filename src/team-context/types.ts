import type { SystemOneRequest } from '@typesafe-ai/sdk';

export const TEAM_CONTEXT_VERSION = 'team-evidence-and-memory-v1';
export const TEAM_BRIEF_POLICY = Object.freeze({ threshold: 0.5, maxResources: 6, maxLinks: 2,
  maxContextBytes: 2_048, questionsPerBatch: 24, identicalRequestRetries: 0 });
export type TeamContextQuery = (label: string, request: SystemOneRequest) => Promise<unknown>;
export type ResourceEvidence = {
  id: string; actorId: string; speciesId: string; resourceId: string;
  kind: 'move' | 'ability' | 'item'; text: string;
  provenance: { kind: 'wiki'; sourceId: string; sourceHash: string; engineRevision: string };
};
export type BriefLink = { id: string; kind: 'cooperation' | 'interference'; resources: [string, string]; epistemic: 'jev-inference' };
export type TeamBrief = {
  version: typeof TEAM_CONTEXT_VERSION; cacheKey: string; formatId: string; ourSide: string;
  actorIds: string[]; resources: ResourceEvidence[]; links: BriefLink[];
};
export type BattleMemoryState = {
  version: typeof TEAM_CONTEXT_VERSION; battleId: string; ourSide: string;
  logLength: number; logHash: string; snapshot: Record<string, unknown>;
};
