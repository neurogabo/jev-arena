import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { DecisionInput } from './types.js';
import type { ControllerEvent } from './controller.js';

type Row = Record<string, any>;
const row = (value: unknown): Row => value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
const list = (value: unknown): Row[] => Array.isArray(value) ? value.map(row) : [];
const text = (value: unknown) => typeof value === 'string' ? value : '';
const clone = <T>(value: T): T => structuredClone(value);
const publicEvent = /^\|(?:turn|move|cant|switch|drag|replace|faint|win|tie|-damage|-heal|-status|-curestatus|-ability|-item|-enditem|-weather|-fieldstart|-fieldend|-sidestart|-sideend|-boost|-unboost|-mega|-immune|-fail|-miss|-activate|-crit|-supereffective|-resisted|-start|-end|-singleturn|-singlemove)\|/;

/** Describe only endpoint evidence in the delivered brief. Never infer a winner from HP ranges. */
export function simulationHighlights(action: Row, brief: Row) {
  const patterns = list(action.responses).flatMap(response => list(response.jointOutcomePatterns));
  const count = (side: string) => patterns.reduce((sum, pattern) => sum +
    (Array.isArray(pattern.faintedAtEnd) && pattern.faintedAtEnd.some((name: string) => name.startsWith(side) && name.endsWith('(newly fainted)')) ? Number(pattern.count) || 0 : 0), 0);
  const hp = new Map<string, { name: string; side: string; min: number; max: number }>();
  const rows = [...(action.pokemonMarginalsSharedByEveryResponse || []), ...list(action.responses).flatMap(r => r.pokemon || [])];
  for (let line of rows) {
    if (typeof line !== 'string') continue;
    const reference = /^\[see (evidence\d+)\]$/.exec(line);
    if (reference) line = row(brief.sharedEvidence)[reference[1]!] || line;
    const match = /^(Your|Opponent) (.+) \[([^\]]+)\]: ([\d.]+)% HP/.exec(line);
    if (!match) continue;
    const range = match[4]!.split('..').map(Number);
    if (!range.every(n => Number.isFinite(n) && n >= 0 && n <= 100)) continue;
    const old = hp.get(match[3]!);
    hp.set(match[3]!, { name: match[2]!, side: match[1] === 'Your' ? 'Jev' : 'You',
      min: Math.min(old?.min ?? 100, ...range), max: Math.max(old?.max ?? 0, ...range) });
  }
  return { branchesWithNewJevKO: count('Your '), branchesWithNewHumanKO: count('Opponent '),
    resolvedWithPatterns: patterns.reduce((sum, pattern) => sum + (Number(pattern.count) || 0), 0), hp: [...hp.values()] };
}

/** Render only public protocol facts. Exact protocol stays available separately. */
export function describeReviewEvent(line: string): string {
  const [, kind, actor = '', value = '', target = ''] = line.split('|');
  const name = (id: string) => id.replace(/^p[12][ab]?: /, '');
  switch (kind) {
    case 'move': return `${name(actor)} used ${value}${target ? ` → ${name(target)}` : ''}.`;
    case 'switch': case 'drag': return `${name(actor)} entered the field (${value.split(',')[0]}).`;
    case 'faint': return `${name(actor)} was knocked out.`;
    case '-damage': case '-heal': return `${name(actor)}: ${value} HP${kind === '-heal' ? ' after healing' : ''}.`;
    case '-status': return `${name(actor)} became ${value}.`;
    case '-ability': case '-item': return `${name(actor)} revealed ${value}.`;
    case '-enditem': return `${name(actor)} lost or consumed ${value}.`;
    case '-mega': return `${name(actor)} Mega Evolved.`;
    case 'cant': return `${name(actor)} could not act (${value}).`;
    case '-crit': return `${name(actor)} received a critical hit.`;
    case '-supereffective': return `The hit on ${name(actor)} was super effective.`;
    case '-resisted': return `${name(actor)} resisted the hit.`;
    case '-immune': return `${name(actor)} was immune.`;
    case '-miss': return `${name(actor)} missed${value ? ` ${name(value)}` : ''}.`;
    case '-boost': case '-unboost': {
      const stats: Record<string, string> = { atk: 'Attack', def: 'Defense', spa: 'Special Attack', spd: 'Special Defense', spe: 'Speed', accuracy: 'accuracy', evasion: 'evasion' };
      return `${name(actor)}: ${stats[value] || value} ${kind === '-boost' ? 'rose' : 'fell'} by ${target} stage(s).`;
    }
    case '-weather': return actor === 'none' ? 'The weather cleared.' : `Weather: ${actor}${value === '[upkeep]' ? ' continues' : ''}.`;
    case '-singleturn': case '-singlemove': case '-activate': return `${name(actor)}: ${value.replace(/^(move|ability): /, '')} activated.`;
    case 'win': return `${actor} won the battle.`;
    case 'tie': return 'The battle ended in a tie.';
    case 'turn': return `Turn ${actor} began.`;
    default: return line.replace(/^\|/, '').split('|').join(' · ');
  }
}

type Evidence = { rules: string; teamBrief: unknown; memory: Row; brief: Row; simulation: Row };
type Entry = {
  id: string; key: string; path: string; phase: string; turn: number; rqid: unknown;
  status: 'preparing' | 'recommended' | 'sent' | 'resolved' | 'discarded' | 'error';
  input: DecisionInput; canonical?: DecisionInput; artifacts: Map<string, unknown>;
  requests: Map<string, { file: string; evidence: Evidence; questions: number; stage: string }>;
  lastEvidence?: Evidence; finalRequest?: string; outcome: string[]; observed: string[];
  started: number; elapsedMs?: number;
};
type Battle = { id: string; label: string; mode: string; ended: boolean; result: string; entries: Entry[]; log: string[]; turn: number };

/** A view of existing decisions. It never calls a model, chooses an action or reads a live Battle.
 * Detailed data is released by the server after resolution (teaching) or battle end (normal).
 * Exact inputs are read only from registered request artifacts, never a client-supplied path.
 */
export class DecisionReview {
  private battles = new Map<string, Battle>();
  private serial = 0;
  start(id: string, label: string, mode: string) {
    for (const battle of this.battles.values()) if (!battle.ended) {
      battle.ended = true; battle.result = 'Battle replaced by a new game.';
      for (const entry of battle.entries) if (['preparing', 'recommended', 'sent'].includes(entry.status)) entry.status = 'discarded';
    }
    this.battles.set(id, { id, label, mode, ended: false, result: '', entries: [], log: [], turn: 0 });
    // Retain recent battles across rematches, but do not grow the archive without bound.
    while (this.battles.size > 5) this.battles.delete(this.battles.keys().next().value!);
  }
  begin(battleId: string, input: DecisionInput, path: string) {
    const battle = this.battles.get(battleId);
    if (!battle) return;
    battle.entries.push({ id: `decision-${++this.serial}`, key: input.key, path, phase: input.phase,
      turn: battle.turn, rqid: input.requestIdentity?.rqid ?? row(input.state.request).rqid,
      status: 'preparing', input: clone(input), artifacts: new Map(), requests: new Map(), outcome: [],
      observed: battle.log.slice(-20), started: Date.now() });
  }
  private entry(battleId: string, key: string) {
    return this.battles.get(battleId)?.entries.slice().reverse().find(entry => entry.key === key);
  }
  capture(battleId: string, key: string, name: string, value: unknown) {
    const entry = this.entry(battleId, key);
    if (!entry || entry.status === 'discarded' || entry.status === 'error') return;
    const data = row(value);
    if (name === 'canonical-observation.json') {
      entry.canonical = clone(data.input); entry.turn = row(row(data.input).state?.request).turn ?? entry.turn;
    }
    // Allowlist, not a public directory of internal artifacts (which may contain seeds).
    if (['top4-shortlist.json', 'recommendation.json', 'live-sim-audit.json', 'simulation-hypotheses-audit.json'].includes(name)) {
      entry.artifacts.set(name, clone(value));
    }
    if (/^[a-z0-9-]+-request\.json$/.test(name)) {
      const state = row(data.state);
      const label = name.slice(0, -13);
      entry.requests.set(label, { file: name, stage: text(state.stage) || 'context', questions: Object.keys(row(data.questions)).length,
        evidence: { rules: text(state.v4Context), teamBrief: clone(state.teamBrief ?? null),
          memory: clone(row(state.battleMemory)), brief: clone(row(state.consequenceBrief)), simulation: clone(row(state.simulation)) } });
    }
    if (name.endsWith('-response.json')) {
      const label = name.slice(0, -14), request = entry.requests.get(label);
      if (request && row(row(data.answers).selection).type === 'choice') {
        entry.lastEvidence = request.evidence; entry.finalRequest = label;
      }
    }
    if (name === 'recommendation.json') entry.elapsedMs = Date.now() - entry.started;
  }
  event(battleId: string, event: ControllerEvent) {
    const battle = this.battles.get(battleId);
    if (!battle) return;
    const entry = event.key ? this.entry(battleId, event.key) : battle.entries.slice().reverse().find(e => e.status === 'sent');
    if (!entry || entry.status === 'resolved') return;
    if (event.type === 'recommendation') entry.status = 'recommended';
    if (event.type === 'sent') {
      entry.status = 'sent';
      if (!entry.artifacts.has('recommendation.json')) {
        const selected = entry.input.candidates.find(action => action.id === event.actionId);
        if (selected) entry.artifacts.set('recommendation.json', clone(selected));
      }
    }
    if (event.type === 'discarded-stale') entry.status = 'discarded';
    if (event.type === 'recoverable-error' || event.type === 'server-rejected') entry.status = 'error';
  }
  observe(battleId: string, line: string) {
    const battle = this.battles.get(battleId);
    if (!battle) return;
    if (publicEvent.test(line) || line === '|tie') {
      battle.log.push(line);
      for (const entry of battle.entries.filter(e => e.status === 'sent')) entry.outcome.push(line);
    }
    if (line.startsWith('|turn|')) battle.turn = Number(line.split('|')[2]) || battle.turn;
    if (/^\|(win|tie)(?:\||$)/.test(line)) { battle.ended = true; battle.result = describeReviewEvent(line); }
    // Even an actionable replacement can interrupt a turn before the other move executes.
    // Release the entire joint choice only at a new turn or battle end, never on a request.
    for (const entry of battle.entries.filter(e => e.status === 'sent')) {
      if (battle.ended || line.startsWith('|turn|')) entry.status = 'resolved';
    }
  }
  private visible(battle: Battle, teaching: boolean) {
    return (battle.ended || teaching) ? battle.entries.filter(entry => entry.status === 'resolved') : [];
  }
  index(battleId: string, teaching = false) {
    const battle = this.battles.get(battleId);
    const archived = [...this.battles.values()].map(b => ({ id: b.id, label: b.label, ended: b.ended, result: b.result, mode: b.mode }));
    if (!battle) return { battles: archived, battle: null, decisions: [], pending: false };
    return { battles: archived, battle: { id: battle.id, label: battle.label, ended: battle.ended, result: battle.result, mode: battle.mode },
      locked: !battle.ended && !teaching,
      pending: battle.entries.some(e => ['preparing', 'recommended', 'sent'].includes(e.status)),
      decisions: this.visible(battle, teaching).map(e => ({ id: e.id, turn: e.turn, phase: e.phase,
        label: e.phase === 'team-preview' ? 'Team selection' : `Turn ${e.turn}${e.phase === 'replacement' ? ' · Replacement' : ''}`,
        choice: text(row(e.artifacts.get('recommendation.json')).description) })) };
  }
  private allowed(battleId: string, id: string, teaching: boolean) {
    const battle = this.battles.get(battleId);
    return battle && this.visible(battle, teaching).find(e => e.id === id);
  }
  detail(battleId: string, id: string, teaching = false) {
    const entry = this.allowed(battleId, id, teaching);
    if (!entry) return null;
    const recommendation = row(entry.artifacts.get('recommendation.json'));
    const shortlist = row(entry.artifacts.get('top4-shortlist.json'));
    const audit = row(entry.artifacts.get('live-sim-audit.json'));
    const evidence = entry.lastEvidence;
    const initial = row(row(shortlist.audit).finalDistribution);
    const finalIds = Object.keys(row(recommendation.probabilities));
    const actions = list(shortlist.actions).length ? list(shortlist.actions) : entry.input.candidates.filter(a => finalIds.includes(a.id) || a.id === recommendation.id);
    const state = entry.canonical?.state ?? {};
    const ourSide = row(state.request).ourSide ?? entry.input.requestIdentity?.ourSide;
    return clone({ id: entry.id, turn: entry.turn, phase: entry.phase, rqid: entry.rqid,
      mode: this.battles.get(battleId)!.mode, elapsedMs: audit.elapsedMs ?? entry.elapsedMs ?? null,
      originalCount: entry.input.candidates.length, choice: { id: recommendation.id, description: recommendation.description,
        probability: row(recommendation.probabilities)[recommendation.id] ?? null, confidence: recommendation.confidence ?? null },
      initial: Object.keys(initial).length ? initial : null, finalCount: finalIds.length,
      actions: actions.map(action => ({ id: action.id, description: action.description, chosen: action.id === recommendation.id,
        initialProbability: row(initial.probabilities)[action.id] ?? null, finalProbability: row(recommendation.probabilities)[action.id] ?? null,
        outcomes: list(evidence?.brief.actions).find(a => a.id === action.id)?.testedOutcomes ?? null,
        highlights: evidence?.simulation.status === 'available' ? simulationHighlights(list(evidence.brief.actions).find(a => a.id === action.id) ?? {}, evidence.brief) : null })),
      position: list(state.pokemon).map(p => ({ id: p.id, name: p.name, species: text(p.speciesId).replace(/^pokemon:/, ''),
        side: p.side === ourSide ? 'Jev' : 'You', active: p.slot !== null && p.slot !== undefined, hp: p.hp,
        fainted: p.fainted, status: p.status, moves: p.knownMoveIds, ability: p.abilityId, item: p.item })),
      observed: entry.observed.map(describeReviewEvent), memoryChanges: list(evidence?.memory.changes),
      rules: evidence?.rules || '', teamBrief: evidence?.teamBrief ?? null,
      simulation: { status: evidence?.simulation.status ?? 'unavailable', reasons: evidence?.simulation.reasons ?? row(audit.simulation).reasons ?? [],
        coverage: evidence?.simulation.status === 'available' ? evidence.brief.coverage ?? null : null,
        brief: evidence?.simulation.status === 'available' ? evidence.brief : null,
        assumptions: evidence?.simulation.status === 'available' ? list(row(entry.artifacts.get('simulation-hypotheses-audit.json')).assumptions) : [] },
      outcome: entry.outcome.map(describeReviewEvent), outcomeLog: entry.outcome,
      requests: [...entry.requests].map(([id, r]) => ({ id, stage: r.stage, questions: r.questions })), finalRequest: entry.finalRequest,
      lifecycle: ['Recommended', 'Sent to Showdown', 'Update observed'],
    });
  }
  async exact(battleId: string, id: string, requestId: string, teaching = false) {
    const entry = this.allowed(battleId, id, teaching), request = entry?.requests.get(requestId);
    if (!entry || !request) return null;
    const data = JSON.parse(await readFile(resolve(entry.path, request.file), 'utf8'));
    // These are the actual model fields. No headers, credentials, paths or response metadata.
    return { model: data.model, state: data.state, questions: data.questions };
  }
}
