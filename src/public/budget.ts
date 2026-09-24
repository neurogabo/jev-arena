import type { DatabaseSync } from 'node:sqlite';

// Jev 1.13 accepts at most 64k input tokens per request. Never estimate billed
// tokens with a different model's tokenizer. Uncertain requests keep this charge.
export const MAX_INPUT_TOKENS = 65_536;
export const utcMonth = (now = Date.now()) => new Date(now).toISOString().slice(0, 7);
export function nextMonth(now = Date.now()) {
  const date = new Date(now);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1)).toISOString().slice(0, 7);
}
export class BudgetUnavailable extends Error {
  constructor() { super('The demo allowance is currently reserved or used up. Try again after a game ends, or on the first day of next month (UTC). Saved reviews remain available.'); }
}

/** Called inside the store's transactions; all money-related state has one writer. */
export class TokenBudget {
  constructor(private db: DatabaseSync) {
    db.exec(`CREATE TABLE IF NOT EXISTS token_months(month TEXT PRIMARY KEY, spent INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS token_holds(battle TEXT NOT NULL, month TEXT NOT NULL, remaining INTEGER NOT NULL, PRIMARY KEY(battle,month));
      CREATE TABLE IF NOT EXISTS token_calls(battle TEXT NOT NULL, call INTEGER NOT NULL, month TEXT NOT NULL,
        charged INTEGER NOT NULL, settled INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(battle,call));`);
  }
  available(month: string, limit: number) {
    const spent = Number(this.db.prepare('SELECT spent FROM token_months WHERE month=?').get(month)?.spent ?? 0);
    const held = Number(this.db.prepare('SELECT COALESCE(SUM(remaining),0) AS total FROM token_holds WHERE month=?').get(month)!.total);
    return Math.max(0, limit - spent - held);
  }
  canAdmit(calls: number, limit: number, now = Date.now()) {
    return [utcMonth(now), nextMonth(now)].every(month => this.available(month, limit) >= calls * MAX_INPUT_TOKENS);
  }
  admit(battle: string, calls: number, limit: number, now = Date.now()) {
    if (!this.canAdmit(calls, limit, now)) throw new BudgetUnavailable();
    // Reserve next month too: a queued or active game can cross midnight on the
    // last day. Its actual calls are charged to the month they were attempted.
    for (const month of [utcMonth(now), nextMonth(now)]) {
      this.db.prepare('INSERT INTO token_holds VALUES(?,?,?)').run(battle, month, calls * MAX_INPUT_TOKENS);
    }
  }
  reserve(battle: string, call: number, now = Date.now()) {
    const month = utcMonth(now);
    if (!Number.isSafeInteger(call) || call < 1 || this.db.prepare('SELECT 1 FROM token_calls WHERE battle=? AND call=?').get(battle, call)) return false;
    if (Number(this.db.prepare('SELECT remaining FROM token_holds WHERE battle=? AND month=?').get(battle, month)?.remaining ?? 0) < MAX_INPUT_TOKENS) return false;
    this.db.prepare('UPDATE token_holds SET remaining=remaining-? WHERE battle=? AND month=?').run(MAX_INPUT_TOKENS, battle, month);
    this.db.prepare('INSERT INTO token_months VALUES(?,?) ON CONFLICT(month) DO UPDATE SET spent=spent+excluded.spent').run(month, MAX_INPUT_TOKENS);
    this.db.prepare('INSERT INTO token_calls(battle,call,month,charged) VALUES(?,?,?,?)').run(battle, call, month, MAX_INPUT_TOKENS);
    return true;
  }
  settle(battle: string, call: number, input: unknown) {
    if (typeof input !== 'number' || !Number.isSafeInteger(input) || input < 0) return false;
    const row = this.db.prepare('SELECT month,charged,settled FROM token_calls WHERE battle=? AND call=?').get(battle, call);
    if (!row || row.settled) return false;
    this.db.prepare('UPDATE token_months SET spent=spent+? WHERE month=?').run(input - Number(row.charged), row.month!);
    this.db.prepare('UPDATE token_calls SET charged=?,settled=1 WHERE battle=? AND call=?').run(input, battle, call);
    return true;
  }
  release(battle: string) { this.db.prepare('DELETE FROM token_holds WHERE battle=?').run(battle); }
}
