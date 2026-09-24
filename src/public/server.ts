import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { Worker } from 'node:worker_threads';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, stat, statfs, rm } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { labPath, clientPublicPath } from '../showdown/engine.js';
import { assignCatalogTeams, loadTeamCatalog, publicCatalog } from '../showdown/catalog.js';
import { ConfigSchema } from '../schema.js';
import { ArenaStore, type BattleRow, type Finish } from './store.js';
import { BudgetUnavailable, MAX_INPUT_TOKENS, nextMonth } from './budget.js';

export type ArenaOptions = { port: number; host?: string; origin: string; dataDir: string; offline: boolean; maxConcurrent?: number;
  maxQueue?: number; dailyCalls?: number; callsPerBattle?: number; idleMs?: number; maxBattleMs?: number; trustProxy?: boolean;
  monthlyTokens?: number; workerMemoryMb?: number; minimumFreeBytes?: number };
class HttpError extends Error { constructor(readonly status: number, message: string) { super(message); } }
const digest = (text: string) => createHash('sha256').update(text).digest('hex');
async function sourceFingerprint() {
  const root = resolve(labPath, 'src');
  const files = (await readdir(root, { recursive:true })).filter(file => file.endsWith('.ts')).map(file => file.replaceAll('\\','/')).sort();
  const hash = createHash('sha256');
  for (const file of files) hash.update(file + '\0' + (await readFile(resolve(root,file),'utf8')).replaceAll('\r\n','\n') + '\0');
  return hash.digest('hex');
}
const validKey = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9-]{8,80}$/.test(value);
const terminal = (row: BattleRow) => !['queued','active'].includes(row.state);
type Running = { worker: Worker; status: Record<string, unknown>; lastSeen: number; started: number;
  pending: Map<string, { resolve: (value: any) => void; timer: NodeJS.Timeout }> };

export async function createArena(options: ArenaOptions) {
  const maxConcurrent = options.maxConcurrent ?? 3, maxQueue = options.maxQueue ?? 20;
  const dailyCalls = options.dailyCalls ?? 500, callsPerBattle = options.callsPerBattle ?? 150;
  const idleMs = options.idleMs ?? 5 * 60_000, maxBattleMs = options.maxBattleMs ?? 60 * 60_000;
  const monthlyTokens = options.monthlyTokens;
  const workerMemoryMb = options.workerMemoryMb ?? 768;
  if (!Number.isSafeInteger(maxConcurrent) || maxConcurrent < 1 || !Number.isSafeInteger(maxQueue) || maxQueue < 0
    || !Number.isSafeInteger(dailyCalls) || dailyCalls < 1 || !Number.isSafeInteger(callsPerBattle) || callsPerBattle < 1) throw new Error('Invalid arena limits.');
  const origin = new URL(options.origin).origin;
  if ((monthlyTokens !== undefined && (!Number.isSafeInteger(monthlyTokens) || monthlyTokens < 1))
    || !Number.isSafeInteger(workerMemoryMb) || workerMemoryMb < 128 || maxBattleMs > 24 * 3600_000) throw new Error('Invalid arena budget or memory limits.');
  if (!options.offline && !process.env.TYPESAFE_API_KEY?.trim()) throw new Error('TYPESAFE_API_KEY is required for live public matches.');
  await mkdir(options.dataDir, { recursive: true });
  const store = new ArenaStore(resolve(options.dataDir, 'arena.sqlite')); store.recover();
  const catalog = await loadTeamCatalog();
  const config = ConfigSchema.parse({ ...JSON.parse(await readFile(resolve(labPath, 'lab.config.json'), 'utf8')), maxStateAndQuestionBytes: 64000, timeoutMs: 60000 });
  const lock = JSON.parse(await readFile(resolve(labPath, 'showdown.lock.json'), 'utf8'));
  if (monthlyTokens !== undefined && config.model !== 'jev-1.13.0') throw new Error('Revalidate the input ceiling and price before changing the budgeted model.');
  const metadata = { architecture: 'v4-top4-brief-v2', opponentInformation: 'revealed-only', hiddenSetSimulation: true,
    model: config.model, engine: lock.server.revision, config, decisionCode: await sourceFingerprint(),
    wiki: digest((await readFile(resolve(labPath, config.wikiPath, 'data/jev-index.json'), 'utf8')).replaceAll('\r\n','\n')) };
  const version = `v4-top4-${digest(JSON.stringify(metadata)).slice(0,12)}`;
  const running = new Map<string, Running>(), queue: string[] = [];
  let stopping = false;
  const mode = options.offline ? 'Offline test' : 'Jev';
  function release(id: string) {
    const entry = running.get(id); if (!entry) return;
    running.delete(id);
    for (const pending of entry.pending.values()) { clearTimeout(pending.timer); pending.resolve({ ok: false, message: 'The match has ended.' }); }
    void entry.worker.terminate(); dispatch();
  }
  function fail(id: string, message = 'The match was interrupted and was not counted.') { store.finish(id, 'error', null, message); release(id); }
  function dispatch() {
    if (stopping) return;
    while (running.size < maxConcurrent && queue.length) {
      const id = queue.shift()!, row = store.battle(id); if (!row || row.state !== 'queued') continue;
      const teams = assignCatalogTeams(catalog, `${row.human},${row.jev}`);
      store.activate(id); store.addEvent(id, '');
      const worker = new Worker(new URL('./worker-bootstrap.mjs', import.meta.url), {
        workerData: { id, teams, offline: options.offline, config, runPath: resolve(options.dataDir, 'traces', id) },
        resourceLimits: { maxOldGenerationSizeMb: workerMemoryMb },
      });
      const entry: Running = { worker, status: { state: 'assigning-teams' }, started: Date.now(), lastSeen: Date.now(), pending: new Map() };
      running.set(id, entry);
      worker.on('message', message => {
        if (running.get(id) !== entry) return;
        if (message.type === 'human') store.addEvent(id, String(message.chunk));
        else if (message.type === 'status') entry.status = { ...entry.status, ...message };
        else if (message.type === 'permit') worker.postMessage({ type: 'permit', key: message.key,
          allowed: store.battle(id)?.state === 'active' && store.reserveCall(id, dailyCalls, callsPerBattle, undefined, monthlyTokens === undefined ? undefined : message.key) });
        else if (message.type === 'usage') {
          if (monthlyTokens === undefined) store.recordUsage(id, Math.max(0, Number(message.input) || 0), Math.max(0, Number(message.output) || 0));
          else {
            store.settleUsage(id, message.key, message.input, message.output);
            if (message.input > MAX_INPUT_TOKENS) { stopping = true; fail(id, 'The demo is paused while its usage accounting is checked.'); }
          }
        }
        else if (message.type === 'result') {
          const kind: Finish = message.kind === 'forfeited' ? 'forfeited' : 'completed';
          const winner = ['human','jev','draw'].includes(message.winner) ? message.winner : null;
          store.finish(id, kind, winner, kind === 'forfeited' ? 'You forfeited. This result is separate from completed battles.' : winner === 'human' ? 'You won the battle.' : winner === 'jev' ? 'Jev won the battle.' : 'The battle ended in a tie.');
        } else if (message.type === 'review') store.saveReview(id, message.bundle);
        else if (message.type === 'ack') { const pending = entry.pending.get(message.key); if (pending) { clearTimeout(pending.timer); entry.pending.delete(message.key); pending.resolve(message); } }
        else if (message.type === 'failure') fail(id, message.message);
        else if (message.type === 'done') release(id);
      });
      worker.once('error', error => { console.error('Battle worker failed:', String(error instanceof Error ? error.message : error).replaceAll(process.env.TYPESAFE_API_KEY || '\0', '[REDACTED]')); fail(id); });
      worker.once('exit', () => { if (running.get(id) === entry) fail(id); });
    }
  }
  async function command(row: BattleRow, key: string, action: string, command?: string, rqid?: number) {
    const fingerprint = digest(JSON.stringify([action, command, rqid]));
    const receipt=store.commandReceipt(row.id,key);
    if(receipt) {
      if(receipt.fingerprint!==fingerprint) throw new HttpError(409, 'This request ID already belongs to another choice.');
      return receipt.result ? { ...receipt.result, duplicate:true } : { ok:false, duplicate:true, message:'This choice is still processing. Wait for the updated turn.' };
    }
    const entry = running.get(row.id);
    if (!entry || row.state !== 'active') throw new HttpError(409, 'This match is not accepting choices.');
    store.command(row.id, key, fingerprint);
    entry.lastSeen = Date.now();
    const result = await new Promise<any>(resolve => {
      const timer = setTimeout(() => { entry.pending.delete(key); resolve({ ok: false, message: 'The battle is still processing. Reconnect to see its current state.' }); }, 20_000);
      entry.pending.set(key, { resolve, timer }); entry.worker.postMessage({ type: 'command', key, action, command, rqid });
    });
    store.commandResult(row.id, key, result);
    return result;
  }
  function status(row?: BattleRow) {
    const base = { mode, publicArena: true, contextMode: 'v4-top4-brief-v2', opponentInformation: 'revealed-only', hiddenSetSimulation: true, version };
    if (!row) return { ...base, state: 'ready' };
    const live = running.get(row.id);
    return { ...base, ...(live?.status ?? {}), battleId: row.id, humanTeam: row.human, jevTeam: row.jev,
      state: row.state === 'queued' ? 'queued' : terminal(row) ? 'ended' : live?.status.state || 'preparing',
      resultKind: terminal(row) ? row.state : undefined, message: row.state === 'queued' ? `Waiting for an arena · position ${queue.indexOf(row.id) + 1}` : terminal(row) ? row.message : live?.status.message,
      queuePosition: row.state === 'queued' ? queue.indexOf(row.id) + 1 : undefined };
  }
  const cleanup = setInterval(() => {
    for (const [id, entry] of running) if (Date.now() - entry.lastSeen > idleMs || Date.now() - entry.started > maxBattleMs) {
      store.finish(id, 'abandoned', null, 'This match expired and was not counted.'); release(id);
    }
    for (const id of [...queue]) { const row = store.battle(id); if (row && Date.now() - row.created > 15 * 60_000) { store.finish(id, 'abandoned', null, 'The queue entry expired. Please try again.'); queue.splice(queue.indexOf(id), 1); } }
  }, 10_000); cleanup.unref();
  async function availability() {
    if (stopping || (await stat(resolve(options.dataDir, 'admission-closed')).catch(() => null))) return { open: false, message: 'The arena is temporarily paused. Saved reviews remain available.' };
    const disk = await statfs(options.dataDir);
    if (disk.bavail * disk.bsize < (options.minimumFreeBytes ?? 512 * 1024 * 1024)) return { open: false, message: 'The arena is temporarily full. Please try again later.' };
    if (!options.offline && monthlyTokens !== undefined && !store.budget.canAdmit(callsPerBattle, monthlyTokens)) return { open: false, message: new BudgetUnavailable().message, resetsAt: `${nextMonth()}-01T00:00:00Z` };
    return { open: true, message: '' };
  }
  async function prune() {
    const cutoff = Date.now() - 30 * 86400_000;
    store.db.prepare("DELETE FROM reviews WHERE battle IN (SELECT id FROM battles WHERE updated<? AND state NOT IN ('active','queued'))").run(cutoff);
    store.db.prepare("DELETE FROM events WHERE battle IN (SELECT id FROM battles WHERE updated<? AND state NOT IN ('active','queued'))").run(cutoff);
    const traceRoot = resolve(options.dataDir, 'traces');
    for (const entry of await readdir(traceRoot, { withFileTypes: true }).catch(() => [])) {
      if (!entry.isDirectory() || !/^battle-jev-[a-f0-9]{32}$/.test(entry.name)) continue;
      const row = store.battle(entry.name), path = resolve(traceRoot, entry.name);
      if (row && terminal(row) && row.updated < Date.now() - 7 * 86400_000 && path.startsWith(traceRoot + sep)) await rm(path, { recursive: true, force: true });
    }
  }
  await prune();
  const retention = setInterval(() => { void prune().catch(() => console.error('Arena retention cleanup failed.')); }, 3600_000); retention.unref();
  function networkKey(req: IncomingMessage) { const forwarded = options.trustProxy ? String(req.headers['x-forwarded-for'] || '').split(',').at(-1)?.trim() : ''; return digest(forwarded || req.socket.remoteAddress || 'unknown'); }
  function session(req: IncomingMessage, res: ServerResponse, create = false) {
    const token = /(?:^|;\s*)jev_guest=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1] || '';
    let found = store.session(token);
    if (!found && create) {
      if (!store.consume(`session:${networkKey(req)}:${Math.floor(Date.now() / 3600_000)}`, 30)) throw new HttpError(429, 'Please wait before opening another guest session.');
      const created = store.createSession(); found = created;
      res.setHeader('Set-Cookie', `jev_guest=${created.token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000${origin.startsWith('https:') ? '; Secure' : ''}`);
    }
    if (!found) throw new HttpError(401, 'Open the arena homepage to start a guest session.');
    return found;
  }
  async function body(req: IncomingMessage) {
    if (!String(req.headers['content-type']).startsWith('application/json')) throw new HttpError(415, 'JSON is required.');
    let text = ''; for await (const chunk of req) { text += chunk; if (Buffer.byteLength(text) > 4096) throw new HttpError(413, 'Request is too large.'); }
    try { const data=JSON.parse(text); if(!data || Array.isArray(data) || typeof data!=='object') throw new Error(); return data; }
    catch { throw new HttpError(400, 'A JSON object is required.'); }
  }
  const json = (res: ServerResponse, value: unknown, code = 200) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(value)); };
  const server = createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    try {
      const url = new URL(req.url || '/', origin);
      if (!['GET','POST'].includes(req.method || '')) throw new HttpError(405, 'Method not allowed.');
      if (url.pathname === '/healthz') { json(res, { ok: true, version }); return; }
      if (url.pathname === '/api/stats' && req.method === 'GET') { json(res, store.stats(version)); return; }
      if (url.pathname === '/api/availability' && req.method === 'GET') { json(res, await availability()); return; }
      if (url.pathname === '/api/teams' && req.method === 'GET') { json(res, publicCatalog(catalog)); return; }
      if (url.pathname.startsWith('/api/')) {
        const guest = session(req, res, url.pathname === '/api/session' && req.method === 'GET');
        if (req.method === 'POST' && (req.headers.origin !== origin || req.headers['x-csrf-token'] !== guest.csrf)) throw new HttpError(403, 'This request does not belong to the current session.');
        if (!store.consume(`http:${guest.id}:${Math.floor(Date.now() / 60_000)}`, 1200)) throw new HttpError(429, 'Please slow down and try again.');
        const ownRows = store.history(guest.id), latest = store.active(guest.id) || ownRows[0];
        const ownBattle = () => {
          const row = store.battle(url.searchParams.get('battle') || latest?.id || '', guest.id);
          if (!row) throw new HttpError(404, 'Battle not found.'); return row;
        };
        if (req.method === 'GET') {
          if (url.pathname === '/api/session') { json(res, { csrf: guest.csrf, active: latest ? status(latest) : null }); return; }
          if (url.pathname === '/api/status') { json(res, status(latest)); return; }
          if (url.pathname === '/api/history') { json(res, ownRows.map(row => ({ id: row.id, state: row.state, winner: row.winner, created: row.created, message: row.message }))); return; }
          if (url.pathname === '/api/feed') {
            const row = ownBattle(), after = Number(url.searchParams.get('after') || 0);
            if (!Number.isSafeInteger(after) || after < 0) throw new HttpError(400, 'Invalid feed cursor.');
            const live = running.get(row.id); if (live) live.lastSeen = Date.now();
            const events = store.events(row.id, after); json(res, { events, cursor: events.at(-1)?.sequence || after, status: status(row) }); return;
          }
          if (url.pathname === '/api/decisions') {
            const row = (latest || url.searchParams.has('battle')) ? ownBattle() : undefined;
            if (!row) { json(res, { battles: [], battle: null, decisions: [], pending: false }); return; }
            const bundle = terminal(row) ? store.review(row.id) : undefined;
            const battles = ownRows.map(b => ({ id: b.id, label: `${b.human} vs ${b.jev}`, ended: terminal(b), result: b.message, mode: b.mode }));
            const decision = url.searchParams.get('decision'), request = url.searchParams.get('request');
            if (decision) {
              const data = request ? bundle?.requests[decision]?.[request] : bundle?.details[decision];
              if (!data) throw new HttpError(404, 'This decision is not available for review.'); json(res, data); return;
            }
            json(res, bundle ? { ...bundle.index, battle:{ ...bundle.index.battle, result:row.message }, battles } : { battles, battle: { id: row.id, ended: terminal(row), result: row.message, mode: row.mode }, locked: !terminal(row), decisions: [], pending: !terminal(row) }); return;
          }
        } else {
          const data = await body(req);
          if (url.pathname === '/api/battles') {
            if (!validKey(data.requestId) || typeof data.human !== 'string' || typeof data.jev !== 'string') throw new HttpError(400, 'Choose two available teams.');
            const admission = await availability();
            const existing = store.existingStart(guest.id, data.requestId); if (existing) { json(res, status(existing)); return; }
            try { assignCatalogTeams(catalog, `${data.human},${data.jev}`); } catch { throw new HttpError(400, 'Choose two available teams.'); }
            const active = store.active(guest.id);
            if (active) throw new HttpError(409, 'Finish or forfeit your current battle before starting another.');
            if (queue.length >= maxQueue && running.size >= maxConcurrent) throw new HttpError(429, 'The arena queue is full. Please try again shortly.');
            if (!admission.open) throw new HttpError(429, admission.message);
            if (!options.offline && !store.remaining(`api:${new Date().toISOString().slice(0, 10)}`, dailyCalls)) throw new HttpError(429, 'Today’s demo request budget is used up. Please return tomorrow.');
            const hour = Math.floor(Date.now() / 3600_000);
            if (!store.consume(`start:${guest.id}:${hour}`, 6) || !store.consume(`ip-start:${networkKey(req)}:${hour}`, 20)) throw new HttpError(429, 'Please wait before starting another battle.');
            const row = store.enqueue(guest.id, data.requestId, data.human, data.jev, version, mode, metadata,
              !options.offline && monthlyTokens !== undefined ? { calls: callsPerBattle, monthlyTokens } : undefined);
            queue.push(row.id); dispatch(); json(res, status(store.battle(row.id)!)); return;
          }
          if (url.pathname === '/api/choice' || url.pathname === '/api/forfeit') {
            if (!validKey(data.requestId) || typeof data.battle !== 'string') throw new HttpError(400, 'Invalid battle request.');
            const row = store.battle(data.battle, guest.id); if (!row) throw new HttpError(404, 'Battle not found.');
            if (url.pathname === '/api/forfeit' && row.state === 'queued') { store.finish(row.id, 'abandoned', null, 'Queue entry cancelled.'); queue.splice(queue.indexOf(row.id), 1); json(res, { ok: true }); return; }
            if (url.pathname === '/api/forfeit' && terminal(row)) { json(res, { ok: true }); return; }
            if (url.pathname === '/api/choice' && (!Number.isSafeInteger(data.rqid) || typeof data.command !== 'string' || data.command.length > 256)) throw new HttpError(400, 'Invalid choice.');
            const result = await command(row, data.requestId, url.pathname === '/api/forfeit' ? 'forfeit' : 'choose', data.command, data.rqid);
            json(res, result, result.ok ? 200 : 409); return;
          }
        }
        throw new HttpError(404, 'Not found.');
      }
      if (req.method !== 'GET') throw new HttpError(405, 'Method not allowed.');
      if (url.pathname === '/') {
        session(req, res, true);
        let html = await readFile(resolve(labPath, 'src/showdown/launcher.html'), 'utf8');
        html = html.replace('<script type="module" src="/demo.js">', '<script>window.jevPublicArena=true;</script><link rel="stylesheet" href="/public.css"><script type="module" src="/public-lobby.js"></script><script type="module" src="/demo.js">')
          .replace('<div class="matchup">', '<section id="scoreboard" aria-label="Jev versus people"><p>Loading the public record…</p></section><div class="matchup">')
          .replace('</nav>', '<button class="text-button" id="end-match" hidden>Leave match</button></nav>')
          .replace('</body>', '<dialog id="end-match-dialog" aria-labelledby="end-match-title"><h2 id="end-match-title">Leave this match?</h2><p>You can review completed turns afterward. A forfeit is recorded separately from completed battles.</p><p id="end-match-error" role="status"></p><div class="dialog-actions"><button class="secondary" id="end-match-cancel">Keep playing</button><button class="primary" id="end-match-confirm">Leave match</button></div></dialog></body>')
          .replace('Private preview · Regulation M-C.', 'Public demo · Regulation M-C. A necessary guest cookie keeps your matches private to this browser for 30 days. Replays and decision reviews are retained for 30 days; diagnostic traces for 7 days. Aggregate results are kept. Battle information is sent to TypeSafe to choose Jev’s moves. No advertising cookies.')
          .replace('<label class="review-teaching">', '<label class="review-teaching" hidden>');
        res.setHeader('Content-Type','text/html'); res.end(html); return;
      }
      if (url.pathname === '/client.html') {
        session(req, res);
        let html = await readFile(resolve(clientPublicPath, 'testclient-new.html'), 'utf8');
        const config = { version:'0', bannedHosts:[], whitelist:[], customcolors:{}, routes:{root:'pokemonshowdown.com',client:'play.pokemonshowdown.com',dex:'dex.pokemonshowdown.com',replays:'replay.pokemonshowdown.com',users:'pokemonshowdown.com/users'}, defaultserver:{id:'jevarena',host:new URL(origin).hostname,port:options.port,registered:false} };
        html = html.replace('<script src="https://play.pokemonshowdown.com/config/config.js"></script>', `<script>window.Config=${JSON.stringify(config)};window.jevClosedInformation=true;</script>`)
          .replace('<script src="js/client-connection.js"></script>', '<script src="js/client-connection.js"></script><script>PS.connection={connected:true,send(){},canReconnect(){return false;}};</script>')
          .replace('</body>', '<script src="/public-transport.js"></script><script src="/client-bridge.js"></script><link rel="stylesheet" href="/arena.css"><script src="/arena.js"></script></body>');
        res.setHeader('Content-Type','text/html'); res.end(html); return;
      }
      if (url.pathname === '/config/testclient-key.js') { res.setHeader('Content-Type','text/javascript'); res.end(''); return; }
      const publicFiles = ['public-lobby.js','public-transport.js','public.css'];
      const shared = ['demo.js','demo.css','demo-selection.js','arena.js','arena.css','inside-jev.js','inside-jev.css','client-bridge.js'];
      const name = url.pathname.slice(1);
      const path = publicFiles.includes(name) ? resolve(labPath, 'src/public', name) : shared.includes(name) ? resolve(labPath, 'src/showdown', name) : resolve(clientPublicPath, '.' + decodeURIComponent(url.pathname));
      if (!publicFiles.includes(name) && !shared.includes(name) && !path.startsWith(clientPublicPath + sep)) throw new HttpError(404, 'Not found.');
      if (!(await stat(path).catch(() => null))?.isFile()) throw new HttpError(404, 'Not found.');
      let content = await readFile(path);
      if (url.pathname === '/js/client-connection.js') content = Buffer.from(content.toString().replace('PSConnection.connect();', '/* Arena uses a session-scoped HTTP transport. */'));
      const mime: Record<string,string> = { '.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.png':'image/png','.gif':'image/gif','.svg':'image/svg+xml','.woff2':'font/woff2' };
      res.setHeader('Content-Type',mime[extname(path)] || 'application/octet-stream'); res.end(content);
    } catch (error) { if (!res.headersSent) json(res, { error: error instanceof HttpError || error instanceof BudgetUnavailable ? error.message : 'Unable to complete this request.' }, error instanceof HttpError ? error.status : error instanceof BudgetUnavailable ? 429 : 500); else res.end(); }
  });
  await new Promise<void>((ok, fail) => { server.once('error', fail); server.listen(options.port, options.host || '127.0.0.1', ok); });
  return { server, store, version, async close() {
    stopping = true; clearInterval(cleanup); clearInterval(retention);
    for (const id of [...running.keys(), ...queue]) store.finish(id, 'abandoned', null, 'The server stopped. This match was not counted.');
    for (const entry of running.values()) for (const pending of entry.pending.values()) {
      clearTimeout(pending.timer); pending.resolve({ ok:false, message:'The server is restarting. This match was not counted.' });
    }
    await Promise.all([...running.values()].map(entry => entry.worker.terminate())); running.clear();
    await new Promise<void>(done => { server.close(() => done()); server.closeAllConnections(); }); store.close();
  } };
}
