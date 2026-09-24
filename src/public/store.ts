import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import { TokenBudget } from './budget.js';

export type Finish = 'completed' | 'forfeited' | 'abandoned' | 'error';
export type BattleRow = { id: string; owner: string; startKey: string; human: string; jev: string; version: string;
  mode: string; state: string; winner: string | null; created: number; updated: number; meta: string; message: string };
export type ReviewBundle = { index: any; details: Record<string, any>; requests: Record<string, Record<string, unknown>> };
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const packed = (value: unknown) => gzipSync(JSON.stringify(value));
const unpack = (value: Uint8Array) => JSON.parse(gunzipSync(value).toString());

/** One database writer in the gateway. Match workers never receive a database connection. */
export class ArenaStore {
  readonly db: DatabaseSync;
  readonly budget: TokenBudget;
  constructor(file: string) {
    this.db = new DatabaseSync(file);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, csrf TEXT NOT NULL, expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS battles (id TEXT PRIMARY KEY, owner TEXT NOT NULL REFERENCES sessions(id), startKey TEXT NOT NULL,
        human TEXT NOT NULL, jev TEXT NOT NULL, version TEXT NOT NULL, mode TEXT NOT NULL, state TEXT NOT NULL,
        winner TEXT, created INTEGER NOT NULL, updated INTEGER NOT NULL, meta TEXT NOT NULL, message TEXT NOT NULL DEFAULT '',
        UNIQUE(owner,startKey));
      CREATE INDEX IF NOT EXISTS owner_battles ON battles(owner,created DESC);
      CREATE INDEX IF NOT EXISTS public_record ON battles(version,mode,state,winner);
      CREATE TABLE IF NOT EXISTS events (sequence INTEGER PRIMARY KEY AUTOINCREMENT, battle TEXT NOT NULL REFERENCES battles(id), chunk TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS battle_events ON events(battle,sequence);
      CREATE TABLE IF NOT EXISTS reviews (battle TEXT PRIMARY KEY REFERENCES battles(id), data BLOB NOT NULL);
      CREATE TABLE IF NOT EXISTS quota (key TEXT PRIMARY KEY, used INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS commands (battle TEXT NOT NULL, id TEXT NOT NULL, PRIMARY KEY(battle,id));
      CREATE TABLE IF NOT EXISTS command_results (battle TEXT NOT NULL, id TEXT NOT NULL, fingerprint TEXT NOT NULL, result TEXT, PRIMARY KEY(battle,id));
      CREATE TABLE IF NOT EXISTS usage (battle TEXT PRIMARY KEY, calls INTEGER NOT NULL DEFAULT 0, input INTEGER NOT NULL DEFAULT 0, output INTEGER NOT NULL DEFAULT 0);
    `);
    this.budget = new TokenBudget(this.db);
  }
  close() { this.db.close(); }
  session(token: string, now = Date.now()) {
    if (!/^[a-f0-9]{64}$/.test(token)) return undefined;
    return this.db.prepare('SELECT id,csrf FROM sessions WHERE id=? AND expires>?').get(hash(token), now) as { id: string; csrf: string } | undefined;
  }
  createSession(now = Date.now()) {
    const token = randomBytes(32).toString('hex'), id = hash(token), csrf = randomBytes(24).toString('hex');
    this.db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(id, csrf, now + 30 * 86400_000);
    return { token, id, csrf };
  }
  consume(key: string, limit: number, amount = 1) {
    if (amount < 1 || amount > limit) return false;
    return Number(this.db.prepare(`INSERT INTO quota VALUES (?,?) ON CONFLICT(key) DO UPDATE SET used=used+excluded.used
      WHERE used+excluded.used<=? RETURNING used`).get(key, amount, limit)?.used ?? 0) !== 0;
  }
  remaining(key: string, limit: number) { return Math.max(0, limit - Number(this.db.prepare('SELECT used FROM quota WHERE key=?').get(key)?.used ?? 0)); }
  battle(id: string, owner?: string) {
    return (owner ? this.db.prepare('SELECT * FROM battles WHERE id=? AND owner=?').get(id, owner)
      : this.db.prepare('SELECT * FROM battles WHERE id=?').get(id)) as BattleRow | undefined;
  }
  history(owner: string) { return this.db.prepare('SELECT * FROM battles WHERE owner=? ORDER BY created DESC LIMIT 50').all(owner) as BattleRow[]; }
  active(owner: string) { return this.db.prepare("SELECT * FROM battles WHERE owner=? AND state IN ('queued','active') ORDER BY created DESC LIMIT 1").get(owner) as BattleRow | undefined; }
  existingStart(owner: string, key: string) { return this.db.prepare('SELECT * FROM battles WHERE owner=? AND startKey=?').get(owner, key) as BattleRow | undefined; }
  enqueue(owner: string, startKey: string, human: string, jev: string, version: string, mode: string, meta: unknown, allowance?: { calls: number; monthlyTokens: number }) {
    const id = `battle-jev-${randomUUID().replaceAll('-', '')}`, now = Date.now();
    this.db.exec('BEGIN IMMEDIATE');
    try {
    if (allowance) this.budget.admit(id, allowance.calls, allowance.monthlyTokens, now);
    this.db.prepare('INSERT INTO battles(id,owner,startKey,human,jev,version,mode,state,created,updated,meta) VALUES(?,?,?,?,?,?,?,\'queued\',?,?,?)')
      .run(id, owner, startKey, human, jev, version, mode, now, now, JSON.stringify(meta));
    this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
    return this.battle(id)!;
  }
  activate(id: string) { this.db.prepare("UPDATE battles SET state='active',updated=? WHERE id=? AND state='queued'").run(Date.now(), id); }
  addEvent(id: string, chunk: string) { this.db.prepare('INSERT INTO events(battle,chunk) VALUES(?,?)').run(id, chunk); }
  events(id: string, after: number) { return this.db.prepare('SELECT sequence,chunk FROM events WHERE battle=? AND sequence>? ORDER BY sequence LIMIT 250').all(id, after) as { sequence: number; chunk: string }[]; }
  command(id: string, key: string, fingerprint: string) {
    const inserted = Number(this.db.prepare('INSERT OR IGNORE INTO command_results(battle,id,fingerprint) VALUES(?,?,?)').run(id, key, fingerprint).changes) === 1;
    const row = this.db.prepare('SELECT fingerprint,result FROM command_results WHERE battle=? AND id=?').get(id, key)!;
    return { inserted, fingerprint: String(row.fingerprint), result: row.result ? JSON.parse(String(row.result)) : null };
  }
  commandResult(id: string, key: string, result: unknown) { this.db.prepare('UPDATE command_results SET result=? WHERE battle=? AND id=?').run(JSON.stringify(result), id, key); }
  commandReceipt(id: string, key: string) {
    const row=this.db.prepare('SELECT fingerprint,result FROM command_results WHERE battle=? AND id=?').get(id,key);
    return row ? { fingerprint:String(row.fingerprint), result:row.result ? JSON.parse(String(row.result)) : null } : undefined;
  }
  reserveCall(id: string, dailyLimit: number, battleLimit: number, day = new Date().toISOString().slice(0, 10), budgetCall?: number) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const key = `api:${day}`;
      const calls = Number(this.db.prepare('SELECT calls FROM usage WHERE battle=?').get(id)?.calls ?? 0);
      if (calls >= battleLimit || !this.remaining(key, dailyLimit)) { this.db.exec('ROLLBACK'); return false; }
      if (budgetCall !== undefined && !this.budget.reserve(id, budgetCall)) { this.db.exec('ROLLBACK'); return false; }
      this.consume(key, dailyLimit);
      this.db.prepare('INSERT INTO usage(battle,calls) VALUES(?,1) ON CONFLICT(battle) DO UPDATE SET calls=calls+1').run(id);
      this.db.exec('COMMIT'); return true;
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  recordUsage(id: string, input: number, output: number) {
    this.db.prepare('UPDATE usage SET input=input+?,output=output+? WHERE battle=?').run(input, output, id);
  }
  settleUsage(id: string, call: number, input: unknown, output: unknown) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      if (this.budget.settle(id, call, input)) this.recordUsage(id, input as number, typeof output === 'number' && Number.isSafeInteger(output) && output >= 0 ? output : 0);
      this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  saveReview(id: string, data: ReviewBundle) { this.db.prepare('INSERT INTO reviews VALUES(?,?) ON CONFLICT(battle) DO UPDATE SET data=excluded.data').run(id, packed(data)); }
  review(id: string): ReviewBundle | undefined { const row = this.db.prepare('SELECT data FROM reviews WHERE battle=?').get(id); return row ? unpack(row.data as Uint8Array) : undefined; }
  finish(id: string, state: Finish, winner: string | null, message: string) {
    // Conditional transition is the authoritative, exactly-once result ledger.
    const changed = Number(this.db.prepare("UPDATE battles SET state=?,winner=?,message=?,updated=? WHERE id=? AND state IN ('active','queued')")
      .run(state, winner, message, Date.now(), id).changes) === 1;
    this.budget.release(id);
    return changed;
  }
  recover() {
    this.db.prepare("UPDATE battles SET state='abandoned',winner=NULL,message='The server restarted. This match was not counted.',updated=? WHERE state IN ('active','queued')").run(Date.now());
    this.db.exec('DELETE FROM token_holds'); // Attempted calls remain charged, including unknown usage.
  }
  stats(version: string) {
    const rows = this.db.prepare("SELECT state,winner,COUNT(*) AS total FROM battles WHERE version=? AND mode='Jev' GROUP BY state,winner").all(version);
    const count = (state: string, winner?: string) => rows.filter(r => r.state === state && (!winner || r.winner === winner)).reduce((n, r) => n + Number(r.total), 0);
    const jevWins = count('completed','jev'), humanWins = count('completed','human'), draws = count('completed','draw');
    const completed = jevWins + humanWins + draws;
    return { version, jevWins, humanWins, draws, completed, winRate: completed ? jevWins / completed : null,
      forfeits: count('forfeited'), abandoned: count('abandoned'), errors: count('error') };
  }
}
