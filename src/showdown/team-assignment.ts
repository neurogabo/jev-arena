import type { PracticeTeams } from './types.js';

export type TeamAssignment = 'standard' | 'swapped';

export function isTeamAssignment(value: unknown): value is TeamAssignment {
  return value === 'standard' || value === 'swapped';
}

/** Assign the published sheets to player roles without changing their sets or provenance. */
export function assignTeams(base: PracticeTeams, assignment: TeamAssignment = 'standard'): PracticeTeams {
  if (!isTeamAssignment(assignment)) throw new Error('Unknown team assignment');
  const teams = structuredClone(assignment === 'swapped' ? { human: base.jev, jev: base.human } : base);
  for (const side of ['human', 'jev'] as const) {
    teams[side].members.forEach((member, index) => { member.id = `${side}-${index + 1}`; });
  }
  return teams;
}
