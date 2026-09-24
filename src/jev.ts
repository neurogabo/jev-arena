import { TypeSafeClient } from '@typesafe-ai/sdk';
import type { SystemOneRequest } from '@typesafe-ai/sdk';
import type { Config } from './schema.js';

export interface Evaluator {
  evaluate(request: SystemOneRequest): Promise<unknown>;
}

// No client or network request is created at import time. Offline preparation
// and future tests use plain data or an injected evaluator.
export function createLiveEvaluator(config: Config, live: boolean): Evaluator {
  if (!live) throw new Error('Network disabled: explicit --live is required.');
  const apiKey = process.env.TYPESAFE_API_KEY?.trim();
  if (!apiKey) throw new Error('TYPESAFE_API_KEY is missing from the local process environment.');
  const client = new TypeSafeClient({
    apiKey, baseURL: 'https://api.typesafe.ai', defaultModel: config.model,
    timeout: config.timeoutMs, retry: { maxRetries: 0 }, logLevel: 'off',
  });
  return { evaluate: request => client.systemOne(request) };
}
