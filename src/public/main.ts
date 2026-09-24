import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { ensureShowdown } from '../../scripts/setup-showdown.js';
import { createArena } from './server.js';
const port = Number(process.env.ARENA_PORT || 8160);
const origin = process.env.ARENA_ORIGIN || `http://127.0.0.1:${port}`;
const { values } = parseArgs({ options: { offline: { type: 'boolean' } } });
const offline = values.offline === true || process.env.ARENA_OFFLINE === '1';
if (!offline && !process.env.TYPESAFE_API_KEY?.trim()) {
  throw new Error('Set TYPESAFE_API_KEY in .env for live play, or run npm run start:offline.');
}
await ensureShowdown();
const arena = await createArena({ port, origin, host: process.env.ARENA_HOST || '127.0.0.1',
  offline, dataDir: resolve(process.env.ARENA_DATA_DIR || '.arena-data'),
  maxConcurrent: Number(process.env.ARENA_MAX_CONCURRENT || 3), maxQueue: Number(process.env.ARENA_MAX_QUEUE || 20), dailyCalls: Number(process.env.ARENA_DAILY_CALLS || 500),
  callsPerBattle: Number(process.env.ARENA_CALLS_PER_BATTLE || 150), trustProxy: process.env.ARENA_TRUST_PROXY === '1',
  monthlyTokens: process.env.ARENA_MONTHLY_TOKENS ? Number(process.env.ARENA_MONTHLY_TOKENS) : undefined,
  workerMemoryMb: Number(process.env.ARENA_WORKER_MEMORY_MB || 768),
  minimumFreeBytes: Number(process.env.ARENA_MINIMUM_FREE_BYTES || 536870912) });
console.log(`Jev Arena: ${origin} · ${offline ? 'OFFLINE TEST (excluded from scoreboard)' : 'Live Jev'} · ${arena.version}`);
let closing = false;
for (const signal of ['SIGINT','SIGTERM'] as const) process.on(signal, () => { if (closing) return; closing = true; void arena.close().then(() => process.exit(0)); });
