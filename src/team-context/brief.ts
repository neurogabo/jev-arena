import type { SystemOneRequest } from '@typesafe-ai/sdk';
import { assertBudget, measureRequest } from '../context.js';
import { requestHash, validateV6Response } from '../context-v6/questions.js';
import type { ConciseKnowledge } from '../knowledge/concise.js';
import type { SaveArtifact } from '../pipeline.js';
import type { Config } from '../schema.js';
import type { DecisionInput } from '../showdown/types.js';
import { byteLength, currentObservation, finite, record, resourceAvailability, strings, text } from './observation.js';
import { TEAM_BRIEF_POLICY, TEAM_CONTEXT_VERSION } from './types.js';
import type { BriefLink, ResourceEvidence, TeamBrief, TeamContextQuery } from './types.js';

function teamSignature(input: DecisionInput) {
  const { own, ourSide } = currentObservation(input);
  const stats = (value: unknown) => Object.fromEntries(['hp', 'atk', 'def', 'spa', 'spd', 'spe']
    .filter(key => finite(record(value)[key]) !== null).map(key => [key, finite(record(value)[key])]));
  return { formatId: input.state.formatId, ourSide, team: own.map(p => ({ id: p.id, speciesId: p.speciesId,
    types: strings(p.typeIds), ability: p.abilityId ?? null, item: record(p.item).status === 'known' ? record(p.item).cardId : null,
    moves: strings(p.knownMoveIds).slice().sort(), stats: stats(p.stats), initialSet: {
      nature: text(record(p.initialSetDetails).nature), gender: text(record(p.initialSetDetails).gender),
      points: stats(record(p.initialSetDetails).points),
    },
  })).sort((a, b) => a.id.localeCompare(b.id)) };
}

export function teamBriefCacheKey(input: DecisionInput, knowledge: ConciseKnowledge, config: Config): string {
  return requestHash({ version: TEAM_CONTEXT_VERSION, policy: TEAM_BRIEF_POLICY, model: config.model,
    wiki: knowledge.sourceHashes, ...teamSignature(input) });
}

function evidence(input: DecisionInput, knowledge: ConciseKnowledge) {
  const candidates: ResourceEvidence[] = [];
  const omissions: { actorId: string; resourceId: string; reason: string }[] = [];
  for (const pokemon of currentObservation(input).own) {
    const ids = [...strings(pokemon.knownMoveIds), ...(typeof pokemon.abilityId === 'string' ? [pokemon.abilityId] : []),
      ...(record(pokemon.item).status === 'known' ? [record(pokemon.item).cardId] : [])];
    for (const resourceId of [...new Set(ids)].sort()) {
      const kind = resourceId.split(':')[0];
      if (kind !== 'move' && kind !== 'item' && kind !== 'ability') throw new Error(`Unsupported team resource: ${resourceId}`);
      const entity = knowledge.entities[resourceId];
      const source = knowledge.sources[resourceId];
      if (!entity || !source || !entity.description) {
        omissions.push({ actorId: pokemon.id, resourceId, reason: 'no-complete-reviewed-description' }); continue;
      }
      candidates.push({ id: `r${candidates.length + 1}`, actorId: pokemon.id, speciesId: pokemon.speciesId,
        resourceId, kind, text: `${entity.name}: ${entity.description}`, provenance: { kind: 'wiki',
          sourceId: resourceId, sourceHash: source.spanHash, engineRevision: source.engineRevision } });
    }
  }
  return { candidates, omissions };
}

async function judge(prefix: string, state: unknown, criteria: [string, string][], config: Config, query: TeamContextQuery, save: SaveArtifact) {
  const judgments: Record<string, number> = {};
  const calls: { label: string; requestHash: string; questionIds: string[] }[] = [];
  for (let offset = 0; offset < criteria.length;) {
    let count = Math.min(TEAM_BRIEF_POLICY.questionsPerBatch, criteria.length - offset);
    const make = (): SystemOneRequest => ({ model: config.model, state: JSON.parse(JSON.stringify(state)),
      questions: Object.fromEntries(criteria.slice(offset, offset + count).map(([id, instruction]) => [id, { type: 'noul',
        criteria: { true: instruction, false: 'The proposed relevance or relationship is unsupported, redundant, or too weak to retain. None is acceptable.' } }])) });
    while (count > 1) {
      const size = measureRequest(make());
      if (size.requestBytes <= config.maxRequestBytes && size.stateAndLargestQuestionBytes <= config.maxStateAndQuestionBytes) break;
      count = Math.ceil(count / 2);
    }
    const request = make(); assertBudget(request, config);
    const label = `${prefix}-${offset}`;
    await save(`${label}-request.json`, request);
    const raw = await query(label, structuredClone(request));
    await save(`${label}-response.json`, raw);
    const response = validateV6Response(request, raw);
    for (const [id, answer] of Object.entries(response.answers)) {
      if (answer.type !== 'noul') throw new Error('Team evidence requires Noul judgments.');
      judgments[id] = answer.noul;
    }
    calls.push({ label, requestHash: requestHash(request), questionIds: Object.keys(request.questions) }); offset += count;
  }
  return { judgments, calls };
}

function compact(resources: ResourceEvidence[], links: BriefLink[]) {
  return { version: TEAM_CONTEXT_VERSION, interpretation: 'Conditional team resources; links are Jev hypotheses, not active effects or action recommendations.',
    resources: resources.map(r => ({ id: r.id, actor: r.actorId, resource: r.resourceId, text: r.text })), links };
}

export async function buildTeamBrief(input: DecisionInput, knowledge: ConciseKnowledge, config: Config, query: TeamContextQuery, save: SaveArtifact) {
  if (config.model !== 'jev-1.13.0') throw new Error('Team context requires pinned model jev-1.13.0.');
  const original = requestHash(input);
  const extracted = evidence(input, knowledge);
  await save('team-brief-candidates.json', extracted);
  const first = await judge('team-resource-selection', { team: teamSignature(input),
    evidence: extracted.candidates.map(r => ({ id: r.id, actor: r.actorId, resource: r.resourceId, text: r.text })) },
  extracted.candidates.map(r => [r.id, `Does evidence ${r.id} supply a particularly useful conditional capability, limitation, or possible interaction for this own team's compact strategic reference? Judge strategic usefulness across the battle, not whether to choose an action now. Respect all conditions and exceptions in the evidence. Return false when it adds little or cannot be supported. All resources may be declined.`]), config, query, save);
  const resources: ResourceEvidence[] = [];
  const omissions = [...extracted.omissions.map(row => ({ ...row, id: null as string | null })), ...extracted.candidates.filter(r => first.judgments[r.id]! < TEAM_BRIEF_POLICY.threshold)
    .map(r => ({ id: r.id, actorId: r.actorId, resourceId: r.resourceId, reason: 'below-threshold' }))];
  for (const candidate of [...extracted.candidates].filter(r => first.judgments[r.id]! >= TEAM_BRIEF_POLICY.threshold)
    .sort((a, b) => first.judgments[b.id]! - first.judgments[a.id]! || a.id.localeCompare(b.id))) {
    const reason = resources.length >= TEAM_BRIEF_POLICY.maxResources ? 'resource-limit'
      : byteLength(compact([...resources, candidate], [])) > TEAM_BRIEF_POLICY.maxContextBytes - 480 ? 'whole-unit-budget' : null;
    if (reason) omissions.push({ id: candidate.id, actorId: candidate.actorId, resourceId: candidate.resourceId, reason });
    else resources.push(candidate);
  }
  const linkCandidates: BriefLink[] = [];
  for (let i = 0; i < resources.length; i++) for (let j = i + 1; j < resources.length; j++) {
    if (resources[i]!.actorId === resources[j]!.actorId) continue;
    for (const kind of ['cooperation', 'interference'] as const) linkCandidates.push({ id: `l${linkCandidates.length + 1}`, kind,
      resources: [resources[i]!.id, resources[j]!.id], epistemic: 'jev-inference' });
  }
  const second = await judge('team-link-selection', { team: teamSignature(input), evidence: compact(resources, []).resources, candidates: linkCandidates },
    linkCandidates.map(l => [l.id, `Do the complete supplied definitions of ${l.resources.join(' and ')} support a meaningful potential ${l.kind} between their two team members? This is a conditional relationship, not a claim that either effect is active, available this turn, or that an action is best. Require an explicit mechanical connection grounded in both definitions; generic shared usefulness is insufficient. Return false when unsupported.`]), config, query, save);
  const links: BriefLink[] = [];
  const linkOmissions: { id: string; reason: string }[] = [];
  for (const link of [...linkCandidates].sort((a, b) => second.judgments[b.id]! - second.judgments[a.id]! || a.id.localeCompare(b.id))) {
    const reason = second.judgments[link.id]! < TEAM_BRIEF_POLICY.threshold ? 'below-threshold' : links.length >= TEAM_BRIEF_POLICY.maxLinks ? 'link-limit'
      : byteLength(compact(resources, [...links, link])) > TEAM_BRIEF_POLICY.maxContextBytes ? 'whole-unit-budget' : null;
    if (reason) linkOmissions.push({ id: link.id, reason }); else links.push(link);
  }
  const { ourSide, own } = currentObservation(input);
  const brief: TeamBrief = { version: TEAM_CONTEXT_VERSION, cacheKey: teamBriefCacheKey(input, knowledge, config),
    formatId: String(input.state.formatId ?? ''), ourSide, actorIds: own.map(p => p.id), resources, links };
  const applied = applyTeamBrief(brief, input);
  const audit = { version: TEAM_CONTEXT_VERSION, policy: TEAM_BRIEF_POLICY, cacheKey: brief.cacheKey,
    sourceHashes: knowledge.sourceHashes, candidates: extracted.candidates, resourceJudgments: first.judgments,
    linkCandidates, linkJudgments: second.judgments, calls: [...first.calls, ...second.calls], omissions, linkOmissions,
    application: applied.audit, contextBytes: byteLength(applied.context) };
  if (requestHash(input) !== original) throw new Error('Team context input mutated.');
  await save('team-brief.json', { brief, context: applied.context, audit });
  return { brief, context: applied.context, audit };
}

export function applyTeamBrief(brief: TeamBrief, input: DecisionInput) {
  const observed = currentObservation(input);
  if (brief.version !== TEAM_CONTEXT_VERSION || brief.ourSide !== observed.ourSide || brief.formatId !== input.state.formatId) throw new Error('Team brief environment mismatch.');
  const application = brief.resources.map(r => {
    const actor = observed.own.find(p => p.id === r.actorId);
    return { id: r.id, ...(actor && actor.speciesId !== r.speciesId ? { state: 'unavailable', reason: 'form-changed' }
      : resourceAvailability(input, actor, r.kind, r.resourceId)) };
  });
  const valid = new Set(application.filter(row => row.state !== 'unavailable').map(row => row.id));
  const resources = brief.resources.filter(r => valid.has(r.id) && observed.own.find(p => p.id === r.actorId)?.speciesId === r.speciesId);
  const retained = new Set(resources.map(r => r.id));
  const links = brief.links.filter(l => l.resources.every(id => retained.has(id)));
  const context = compact(resources, links);
  if (byteLength(context) > TEAM_BRIEF_POLICY.maxContextBytes) throw new Error('Cached team brief exceeds its whole-unit budget.');
  return { context, audit: { application, excludedIds: observed.excludedIds, contextBytes: byteLength(context),
    droppedLinks: brief.links.filter(l => !links.includes(l)).map(l => l.id), currentInputKey: input.key } };
}
