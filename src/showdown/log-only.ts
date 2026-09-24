import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import type { EntryType, SystemOneRequest } from '@typesafe-ai/sdk';
import { z } from 'zod';
import type { Config } from '../schema.js';
import type { Evaluator } from '../jev.js';
import type { SaveArtifact } from '../pipeline.js';
import { buildPreviewActions, buildTurnActions } from './actions.js';
import type { BattleRequest, TargetPokemon } from './actions.js';
import type { DecisionInput, RuntimeAction } from './types.js';
import { validatePublicTeamSheetLine } from './public-team-sheet.js';

export const LOG_POLICY_VERSION = 'player-protocol-v1';
export const LOG_SELECTION_INSTRUCTION = 'Select the supplied joint action most likely to win the battle using the player-visible Showdown log and any additional context provided. Choose only one offered action.';
export type LogDecisionConfig = Pick<Config, 'model' | 'maxChoices' | 'maxStateAndQuestionBytes' | 'maxRequestBytes'>;
export type ContextPosition = 'before-log' | 'after-log';
export type LogDecisionOptions = { ourSide?: 'p1' | 'p2'; battleId?: string; allowTournament?: boolean; contextPosition?: ContextPosition };
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const entry = (value: unknown): EntryType => JSON.parse(JSON.stringify(value)) as EntryType;

function logState(showdownLog: string[], extraContext: unknown, contextPosition: ContextPosition = 'after-log') {
  if (contextPosition !== 'before-log' && contextPosition !== 'after-log') throw new Error('contextPosition must be before-log or after-log.');
  // Property order is intentional: prefix experiments must keep the same order
  // in every condition, including the null-context baseline.
  return contextPosition === 'before-log' ? { extraContext, showdownLog } : { showdownLog, extraContext };
}

// Protocol-only whitelist: auxiliary prose, chat, HTML, server debug output,
// team-disclosure extensions, transport and authentication never enter C0.
const publicEvents = new Set([
  'gen', 'gametype', 'tier', 'rule', 'rated', 'player', 'teamsize', 'clearpoke', 'poke', 'teampreview', 'showteam',
  'start', 'turn', 'switch', 'drag', 'replace', 'swap', 'move', 'cant', 'faint', 'win', 'tie', 'upkeep',
  'detailschange', '-formechange', '-transform', '-mega', '-primal', '-burst', '-terastallize',
  '-damage', '-heal', '-sethp', '-status', '-curestatus', '-cureteam', '-boost', '-unboost',
  '-setboost', '-swapboost', '-copyboost', '-clearboost', '-clearallboost', '-clearpositiveboost',
  '-clearnegativeboost', '-invertboost', '-weather', '-fieldstart', '-fieldend', '-fieldactivate',
  '-sidestart', '-sideend', '-swapsideconditions', '-start', '-end', '-singleturn', '-singlemove',
  '-activate', '-ability', '-endability', '-item', '-enditem', '-immune', '-miss', '-fail',
  '-block', '-notarget', '-crit', '-supereffective', '-resisted', '-ohko', '-hitcount',
  '-prepare', '-mustrecharge', '-combine', '-waiting', '-center', '-candynamax',
]);
const statSchema = z.record(z.string(), z.number().finite());
const pokemonSchema = z.object({
  ident: z.string(), details: z.string(), condition: z.string(), active: z.boolean(),
  stats: statSchema.optional(), moves: z.array(z.string()).optional(), baseAbility: z.string().optional(),
  ability: z.string().optional(), item: z.string().optional(), pokeball: z.string().optional(),
  commanding: z.boolean().optional(), reviving: z.boolean().optional(),
  teraType: z.string().optional(), terastallized: z.string().optional(),
}).strict();
const activeSchema = z.object({
  moves: z.array(z.object({ move: z.string(), id: z.string(), pp: z.number().nonnegative().optional(),
    maxpp: z.number().nonnegative().optional(), target: z.string().optional(),
    disabled: z.union([z.boolean(), z.string()]).optional(), disabledSource: z.string().optional() }).strict()),
  trapped: z.boolean().optional(), maybeTrapped: z.boolean().optional(), maybeDisabled: z.boolean().optional(),
  maybeLocked: z.boolean().optional(), canMegaEvo: z.boolean().optional(), canMegaEvoX: z.boolean().optional(),
  canMegaEvoY: z.boolean().optional(),
}).strict();
const requestSchema = z.object({
  rqid: z.number().int().nonnegative().optional(), wait: z.boolean().optional(), teamPreview: z.boolean().optional(),
  maxChosenTeamSize: z.number().int().positive().optional(), forceSwitch: z.array(z.boolean()).optional(),
  active: z.array(activeSchema.nullable()).optional(), noCancel: z.boolean().optional(), update: z.boolean().optional(),
  side: z.object({ id: z.enum(['p1', 'p2']), name: z.string().optional(), pokemon: z.array(pokemonSchema),
    noCancel: z.boolean().optional() }).strict().optional(),
}).strict();

function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
  }
  return value;
}

/** Records only an authorized player stream, not a BattleStream omniscient update. */
export class LogOnlyObserver {
  private lines: string[] = [];
  private request: BattleRequest | null = null;
  private side?: 'p1' | 'p2';
  private isEnded = false;
  private awaitingUpdatedRequest = false;
  constructor(private options: LogDecisionOptions = {}) { this.side = options.ourSide; }
  get ownRequest() { return this.request ? structuredClone(this.request) : null; }
  get ended() { return this.isEnded; }
  get showdownLog() { return [...this.lines]; }
  receive(chunk: string): void {
    for (const line of chunk.split(/\r?\n/)) {
      if (/^\|(?:split|seed|debug|debugerror)\|/.test(line) || /^>p[12]\s/.test(line)) {
        throw new Error('Unsafe omniscient, debug or command stream; use the authorized player stream.');
      }
      if (!line.startsWith('|')) continue;
      const event = line.split('|', 2)[1]!;
      if (event === 'request') {
        const value: unknown = JSON.parse(line.slice('|request|'.length));
        if (value === null) { this.request = null; this.lines.push(line); continue; }
        const request = requestSchema.parse(value);
        if (request.side) {
          if (this.side && this.side !== request.side.id) throw new Error('Opponent private request is forbidden.');
          this.side = request.side.id;
          if (request.side.pokemon.some(pokemon => !pokemon.ident.startsWith(`${this.side}: `))) {
            throw new Error('Private request contains a Pokemon from another side.');
          }
        } else if (!request.wait) throw new Error('Actionable request has no controlled side.');
        this.request = request;
        this.awaitingUpdatedRequest = false;
        this.lines.push(line);
      } else if (publicEvents.has(event)) {
        if (event === 'showteam') validatePublicTeamSheetLine(line);
        this.lines.push(line);
        if (event === 'win' || event === 'tie') this.isEnded = true;
      } else if (event === 'error' && /^\|error\|\[(?:Invalid|Unavailable) choice\]/.test(line)) {
        // Showdown's legal-choice rejection is itself a visible observation.
        this.lines.push(line);
        // A rejection may reveal a restriction absent from the previous menu.
        // Wait for Showdown's replacement request instead of replaying a rejected
        // command or filtering candidates with data outside the player protocol.
        this.awaitingUpdatedRequest = true;
      }
    }
  }
  decision(): DecisionInput | null {
    if (this.ended || this.awaitingUpdatedRequest || !this.request || this.request.wait) return null;
    const request = this.request;
    if (!request.side || !this.side) throw new Error('Missing controlled side.');
    if (!this.lines.some(line => line.startsWith('|tier|'))) throw new Error('Player log must identify its format with |tier|.');
    const activeCount = request.forceSwitch?.length ?? request.active?.length ?? 2;
    const otherSide = this.side === 'p1' ? 'p2' : 'p1';
    const foeSlots = new Map<number, TargetPokemon>();
    for (const line of this.lines) {
      const [, event, ident = '', , condition = ''] = line.split('|');
      const match = /^(p[12])([ab]):\s*(.+)$/.exec(ident);
      if (!match || match[1] !== otherSide) continue;
      const slot = match[2] === 'a' ? 0 : 1;
      if (event === 'switch' || event === 'drag' || event === 'replace') {
        foeSlots.set(slot, { id: ident, name: `${ident}`, slot, alive: !condition.includes('fnt') });
      } else if (event === 'faint') {
        const pokemon = foeSlots.get(slot);
        if (pokemon) pokemon.alive = false;
      } else if (event === 'swap') {
        const destination = Number(line.split('|')[3]);
        if (destination === 0 || destination === 1) {
          const source = foeSlots.get(slot); const target = foeSlots.get(destination);
          const relocated = (pokemon: TargetPokemon, to: number) => ({ ...pokemon, slot: to,
            id: pokemon.id.replace(/^p[12][ab]/, `${otherSide}${to ? 'b' : 'a'}`),
            name: pokemon.name.replace(/^p[12][ab]/, `${otherSide}${to ? 'b' : 'a'}`) });
          if (source) foeSlots.set(destination, relocated(source, destination));
          if (target) foeSlots.set(slot, relocated(target, slot));
        }
      }
    }
    const foes = Array.from({ length: activeCount }, (_, slot) => foeSlots.get(slot) ?? {
      id: `${otherSide}${slot ? 'b' : 'a'}`, name: `${otherSide}${slot ? 'b' : 'a'}`, slot, alive: false,
    });
    const phase: DecisionInput['phase'] = request.teamPreview ? 'team-preview' : request.forceSwitch ? 'replacement' : 'move';
    const candidates = request.teamPreview
      ? buildPreviewActions(request.side.pokemon.map(pokemon => ({ id: pokemon.ident, name: pokemon.ident })), request.maxChosenTeamSize ?? 4)
      : buildTurnActions(request, foes, { neutralDescriptions: true });
    const showdownLog = [...this.lines];
    const requestIdentity = { battleId: this.options.battleId ?? 'player-log', ourSide: this.side, rqid: request.rqid };
    return { phase, candidates, requiredCardIds: [], state: logState(showdownLog, null, this.options.contextPosition), requestIdentity,
      key: hash({ requestIdentity, showdownLog, candidates }) };
  }
}

export function filterPlayerLog(log: string | string[], options: LogDecisionOptions = {}): string[] {
  const observer = new LogOnlyObserver(options);
  for (const line of typeof log === 'string' ? [log] : log) observer.receive(line);
  return observer.showdownLog;
}

function makeRequest(model: string, state: SystemOneRequest['state'], candidates: RuntimeAction[]): SystemOneRequest {
  return { model, state, questions: { selection: { type: 'choice', instructions: LOG_SELECTION_INSTRUCTION,
    criteria: Object.fromEntries(candidates.map(action => [action.id, action.description])) } } };
}
function measure(request: SystemOneRequest) {
  const bytes = (value: unknown) => Buffer.byteLength(JSON.stringify(value), 'utf8');
  const stateBytes = bytes(request.state);
  const largestQuestionBytes = Math.max(...Object.values(request.questions).map(bytes));
  return { stateBytes, largestQuestionBytes, stateAndLargestQuestionBytes: stateBytes + largestQuestionBytes,
    requestBytes: bytes(request), unit: 'utf8-bytes-not-tokens' };
}
function assertFits(request: SystemOneRequest, config: LogDecisionConfig) {
  const size = measure(request);
  if (size.stateAndLargestQuestionBytes > config.maxStateAndQuestionBytes || size.requestBytes > config.maxRequestBytes) {
    throw new Error('Log-only request exceeds the configured byte budget. No log, context or actions were truncated.');
  }
  return size;
}

/** The benchmark and the log-only live player call this exact builder. */
export function prepareLogDecision(log: string | string[], config: LogDecisionConfig, extraContext: unknown = null,
  options: LogDecisionOptions = {}) {
  const observer = new LogOnlyObserver(options);
  for (const line of typeof log === 'string' ? [log] : log) observer.receive(line);
  const input = observer.decision();
  if (!input) throw new Error('Player log does not end at an actionable battle decision.');
  const state = entry(logState(observer.showdownLog, extraContext, options.contextPosition));
  const request = makeRequest(config.model, state, input.candidates);
  if (!options.allowTournament) {
    if (input.candidates.length > Math.min(255, config.maxChoices)) {
      throw new Error(`Log-only benchmark has ${input.candidates.length} actions, above the single-Choice limit. No candidates were removed.`);
    }
    assertFits(request, config);
  }
  return freeze({ request, candidates: input.candidates, input, phase: input.phase,
    rqid: observer.ownRequest?.rqid, ourSide: input.requestIdentity!.ourSide,
    showdownLog: observer.showdownLog, allowTournament: options.allowTournament ?? false,
    filterPolicy: LOG_POLICY_VERSION, size: measure(request) });
}
export type PreparedLogDecision = ReturnType<typeof prepareLogDecision>;
const unit = z.number().finite().min(0).max(1);
const responseSchema = z.object({ model: z.string(), usage: z.object({
  input_tokens: z.number().int().nonnegative(), output_tokens: z.number().int().nonnegative(),
}), answers: z.object({ selection: z.object({ type: z.literal('choice'), choice: z.string(), confidence: unit,
  probabilities: z.record(z.string(), unit) }) }).strict() });

/** No retrieval or fallback heuristic. The explicit provider choice is preserved. */
export async function chooseLogDecision(prepared: PreparedLogDecision, config: LogDecisionConfig,
  evaluator: Evaluator, save: SaveArtifact, assertCurrent: () => Promise<void>) {
  if (prepared.request.model !== config.model) throw new Error('Prepared log-only model differs from the evaluator configuration.');
  const started = performance.now();
  const calls: { label: string; elapsedMs: number; usage: { input_tokens: number; output_tokens: number }; size: ReturnType<typeof measure> }[] = [];
  const usage = { input_tokens: 0, output_tokens: 0 };
  const query = async (label: string, candidates: RuntimeAction[]) => {
    if (candidates.length > Math.min(255, config.maxChoices)) throw new Error('Choice option limit exceeded.');
    const request = makeRequest(config.model, prepared.request.state, candidates);
    const size = assertFits(request, config);
    await save(`${label}-request.json`, request);
    await assertCurrent();
    const callStart = performance.now();
    const raw = await evaluator.evaluate(structuredClone(request));
    const elapsedMs = performance.now() - callStart;
    await save(`${label}-response.json`, raw);
    await assertCurrent();
    const response = responseSchema.parse(raw);
    if (response.model !== config.model || prepared.request.model !== config.model) throw new Error('Unexpected log-only decision model.');
    const answer = response.answers.selection;
    const offered = new Set(candidates.map(action => action.id));
    const ids = Object.keys(answer.probabilities);
    if (!offered.has(answer.choice) || ids.length !== offered.size || ids.some(id => !offered.has(id))) {
      throw new Error('Choice or distribution contains missing or unoffered actions.');
    }
    const values = Object.values(answer.probabilities);
    if (Math.abs(values.reduce((sum, value) => sum + value, 0) - 1) > 0.01 + Number.EPSILON * ids.length) throw new Error('Choice probabilities do not sum to one.');
    usage.input_tokens += response.usage.input_tokens; usage.output_tokens += response.usage.output_tokens;
    calls.push({ label, elapsedMs, usage: response.usage, size });
    return { ...answer, probabilityArgmaxMatches: answer.probabilities[answer.choice]! + 1e-6 >= Math.max(...values) };
  };
  await assertCurrent();
  let finalists = [...prepared.candidates];
  const groups: { round: number; offeredIds: string[]; retainedIds: string[]; providerSelectedId: string }[] = [];
  let round = 0;
  if (prepared.allowTournament) {
    while (finalists.length > Math.min(255, config.maxChoices)) {
      const retained: RuntimeAction[] = [];
      const groupSize = Math.min(120, config.maxChoices);
      const nextSize = Math.floor(finalists.length / groupSize) * Math.min(3, groupSize) + Math.min(3, finalists.length % groupSize);
      if (nextSize >= finalists.length) throw new Error('Configured Choice limit cannot reduce the live tournament without dropping candidates.');
      for (let offset = 0, group = 0; offset < finalists.length; group++) {
        const offered = finalists.slice(offset, offset + groupSize);
        const answer = await query(`choice-round-${round}-${group}`, offered);
        const top = [...offered].sort((a, b) => answer.probabilities[b.id]! - answer.probabilities[a.id]! || a.id.localeCompare(b.id)).slice(0, 3);
        retained.push(...top);
        groups.push({ round, offeredIds: offered.map(action => action.id), retainedIds: top.map(action => action.id), providerSelectedId: answer.choice });
        offset += offered.length;
      }
      finalists = retained; round++;
    }
  }
  const answer = await query('choice-final', finalists);
  const result = { selected: prepared.candidates.find(action => action.id === answer.choice)!, key: prepared.input.key,
    contextMode: 'log-only' as const, confidence: answer.confidence, probabilities: answer.probabilities,
    probabilityArgmaxMatches: answer.probabilityArgmaxMatches, candidateCount: prepared.candidates.length,
    finalistCount: finalists.length, distributionScope: round ? 'finalists-only' as const : 'all-options' as const,
    rounds: round, groups, usage, callCount: calls.length, calls, modelMs: calls.reduce((sum, call) => sum + call.elapsedMs, 0),
    elapsedMs: performance.now() - started, filterPolicy: LOG_POLICY_VERSION };
  await save('recommendation.json', result);
  return result;
}
