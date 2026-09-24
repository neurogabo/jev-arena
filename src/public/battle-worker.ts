import { parentPort, workerData } from 'node:worker_threads';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadEngine, labPath, formatId } from '../showdown/engine.js';
import { LogOnlyObserver } from '../showdown/log-only.js';
import { DecisionController } from '../showdown/controller.js';
import { DecisionReview } from '../showdown/decision-review.js';
import { createLiveEvaluator } from '../jev.js';
import { loadWiki } from '../wiki.js';
import { loadConciseKnowledge } from '../knowledge/concise.js';
import { chooseLiveSimDecision } from '../live-sim/decision.js';
import { applyTeamBrief, buildBattleMemory, buildTeamBrief, teamBriefCacheKey } from '../team-context/index.js';
import type { BattleMemoryState, TeamBrief } from '../team-context/index.js';
import type { Config } from '../schema.js';
import type { PracticeTeams } from '../showdown/types.js';
import type { ReviewBundle } from './store.js';

const port = parentPort!;
const { id, teams, offline, config, runPath } = workerData as { id: string; teams: PracticeTeams; offline: boolean; config: Config; runPath: string };
const emit = (type: string, data: Record<string, unknown> = {}) => port.postMessage({ type, ...data });
const engine = await loadEngine();
const stream = new engine.BattleStream({ keepAlive: true });
// The engine owner configures teams; the decision process receives ONLY p2's filtered stream.
const players = engine.getPlayerStreams(stream);
const own = new LogOnlyObserver({ battleId: id, ourSide: 'p2' });
const human = new LogOnlyObserver({ battleId: id, ourSide: 'p1' });
const review = new DecisionReview();
review.start(id, `${teams.human.label} vs ${teams.jev.label}`, offline ? 'Offline test' : 'Jev');
const wiki = offline ? undefined : await loadWiki(resolve(labPath, config.wikiPath));
const knowledge = wiki ? await loadConciseKnowledge(resolve(labPath, config.wikiPath), wiki) : undefined;
const live = offline ? undefined : createLiveEvaluator(config, true);
let confirmed = false, ended = false, humanPending = false, serial = 0, callSerial = 0, commandChain = Promise.resolve();
const rqid = { p1: 0, p2: 0 };
const permits = new Map<number, (allowed: boolean) => void>();
const briefCache = new Map<string, TeamBrief>();
let previousMemory: BattleMemoryState | undefined;

async function snapshot(): Promise<ReviewBundle> {
  const index = review.index(id), details: Record<string, any> = {}, requests: Record<string, Record<string, unknown>> = {};
  for (const decision of index.decisions) {
    const detail = review.detail(id, decision.id)!; details[decision.id] = detail; requests[decision.id] = {};
    for (const request of detail.requests) requests[decision.id]![request.id] = await review.exact(id, decision.id, request.id);
  }
  return { index, details, requests };
}
async function finish(winner: string, kind: string = 'completed') {
  if (ended) return; ended = true; controller.dispose();
  emit('result', { winner, kind }); // Save outcome immediately; opening a review is never required.
  try { emit('review', { bundle: await snapshot() }); }
  catch { emit('review-error'); }
  finally { emit('done'); }
}
const evaluator = { evaluate: async (request: Parameters<NonNullable<typeof live>['evaluate']>[0]) => {
  const key = ++callSerial;
  const allowed = await new Promise<boolean>(done => { permits.set(key, done); emit('permit', { key }); });
  if (!allowed) throw new Error('The API request budget has been reached. This match is not counted.');
  const response: any = await live!.evaluate(request);
  emit('usage', { key, input: response.usage?.input_tokens, output: response.usage?.output_tokens });
  return response;
} };
const controller = new DecisionController({
  current: () => !confirmed || ended ? null : own.decision(),
  decide: async (input, assertCurrent) => {
    const path = resolve(runPath, String(++serial).padStart(4, '0'));
    await mkdir(path, { recursive: true }); review.begin(id, input, path);
    const save = async (name: string, value: unknown) => { await writeFile(resolve(path, name), JSON.stringify(value)); review.capture(id, input.key, name, value); };
    await save('observation.json', input);
    if (offline) {
      // Explicit no-API test policy. These matches can never contribute to the public counter.
      const score = (command: string) => command.split(', ').reduce((total, part, slot) => {
        const match = /^move (\d+)(?: (-?\d+))?/.exec(part);
        if (!match) return total - (part.startsWith('switch') ? 5 : 0);
        const move = own.ownRequest?.active?.[slot]?.moves[Number(match[1]) - 1];
        return total + engine.Dex.moves.get(move?.id ?? '').basePower + (part.includes('mega') ? 10 : 0) - (match[2]?.startsWith('-') ? 1000 : 0);
      }, 0);
      const selected = input.phase === 'team-preview' ? input.candidates.find(a => a.command === 'team 1234')!
        : [...input.candidates].sort((a, b) => score(b.command) - score(a.command))[0]!;
      await save('recommendation.json', { ...selected, confidence: 1, probabilities: { [selected.id]: 1 }, decisionOrigin: 'scripted-offline' });
      return { selected };
    }
    return chooseLiveSimDecision(input, own.showdownLog, { config, knowledge: knowledge!, evaluator, save, assertCurrent,
      strategy: 'top4-brief-v2', opponentInformation: 'revealed-only', hiddenSetSimulation: true,
      onStatus: event => emit('status', { state: 'preparing', message: event.message }),
      augmentContext: async (canonical, log, query, saveContext) => {
        const key = teamBriefCacheKey(canonical, knowledge!, config);
        let brief = briefCache.get(key); const cacheHit = Boolean(brief);
        if (!brief) { brief = (await buildTeamBrief(canonical, knowledge!, config, query, saveContext)).brief; await assertCurrent(); briefCache.set(key, brief); }
        const applied = applyTeamBrief(brief, canonical), memory = buildBattleMemory(canonical, log, previousMemory);
        await assertCurrent(); previousMemory = memory.memory;
        await saveContext('team-context-current.json', { teamBrief: applied, battleMemory: memory, cacheHit });
        return { teamBrief: applied.context, battleMemory: memory.context };
      },
    });
  },
  send: action => { void players.p2.write(action.command); },
  event: event => {
    review.event(id, event);
    if (event.type === 'recoverable-error') {
      // Public matches fail closed. A failed provider call cannot become a human/AI win.
      emit('failure', { message: 'Jev could not complete the decision. This match is not counted.' }); controller.dispose(); ended = true;
    } else if (!ended && ['preparing','sent'].includes(event.type)) emit('status', { state: event.type });
  },
});

async function consume(side: 'p1' | 'p2') {
  for await (const chunk of players[side]) {
    const lines: string[] = [];
    for (let line of String(chunk).split('\n')) {
      if (line.startsWith('|request|')) {
        const request = JSON.parse(line.slice(9));
        if (request) { request.rqid = ++rqid[side]; line = '|request|' + JSON.stringify(request); }
        if (side === 'p1') humanPending = false;
      }
      if (side === 'p1') human.receive(line);
      else { own.receive(line); review.observe(id, line); }
      lines.push(line);
      if (side === 'p2' && /^\|(win|tie)(?:\||$)/.test(line)) {
        const winner = /^\|tie(?:\||$)/.test(line) ? 'draw' : line.slice(5) === 'JevLocal' ? 'jev' : 'human';
        // Allow p1's final visible chunk to reach the gateway before releasing the worker.
        setImmediate(() => { void finish(winner); });
      }
    }
    if (side === 'p1') emit('human', { chunk: lines.join('\n') });
    else if (!ended) void controller.pump();
  }
}
async function command(message: any) {
  if (ended) throw new Error('This match has ended.');
  if (message.action === 'forfeit') {
    controller.dispose();
    // A forfeit is explicit and classified separately, never a normal Jev win.
    ended = true;
    await stream.write('>forcewin p2');
    await new Promise<void>(done => setImmediate(done));
    emit('result', { winner: 'jev', kind: 'forfeited' });
    try { emit('review', { bundle: await snapshot() }); } finally { setImmediate(() => emit('done')); }
    return;
  }
  const input = human.decision(), request = human.ownRequest;
  if (!input || humanPending || message.rqid !== request?.rqid) throw new Error('This choice is no longer current. Wait for the updated turn.');
  let choice = String(message.command).trim().replace(/,\s*/g, ', ');
  if (input.phase === 'team-preview' && /^team [1-6](?:, [1-6]){3}$/.test(choice)) choice = choice.replaceAll(', ', '');
  // The official client writes e.g. "move 1 mega +1"; our engine menu writes
  // "move 1 1 mega". Match equivalent syntax, then send ONLY the menu's command.
  const key = (command: string) => command.split(',').map(part => {
    const tokens = part.trim().split(/\s+/);
    return [...tokens.slice(0,2), ...tokens.slice(2).map(t => /^\+\d+$/.test(t) ? t.slice(1) : t).sort()].join(' ');
  }).join(', ');
  const candidate = input.candidates.find(a => key(a.command) === key(choice));
  if (/[\r\n]/.test(choice) || !candidate) throw new Error('Choose one of the available moves or switches.');
  if (input.phase === 'team-preview' && confirmed) throw new Error('Team selection is already locked.');
  humanPending = true;
  const before = rqid.p1;
  await players.p1.write(candidate.command);
  if (rqid.p1 === before) emit('human', { chunk: '|request|' + JSON.stringify({ wait: true, noCancel: true, rqid: before }) });
  if (input.phase === 'team-preview') confirmed = true;
  void controller.pump();
}
port.on('message', message => {
  if (message.type === 'permit') { permits.get(message.key)?.(message.allowed); permits.delete(message.key); return; }
  if (message.type === 'command') commandChain = commandChain.then(async () => {
    try { await command(message); emit('ack', { key: message.key, ok: true }); }
    catch (error) { emit('ack', { key: message.key, ok: false, message: error instanceof Error ? error.message : 'Unable to submit choice.' }); }
  });
});
void consume('p1').catch(() => emit('failure', { message: 'The battle engine stopped. This match is not counted.' }));
void consume('p2').catch(() => emit('failure', { message: 'The battle observation failed. This match is not counted.' }));
emit('human', { chunk: '|init|battle\n|title|Trainer vs. Jev\n|users|2, Trainer, JevLocal' });
await stream.write(`>start ${JSON.stringify({ formatid: `${formatId}@@@!Open Team Sheets` })}\n` +
  `>player p1 ${JSON.stringify({ name: 'Trainer', team: teams.human.packed })}\n>player p2 ${JSON.stringify({ name: 'JevLocal', team: teams.jev.packed })}`);
emit('status', { state: 'team-preview' });
