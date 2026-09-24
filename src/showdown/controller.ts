import type { DecisionInput, RuntimeAction } from './types.js';

export type ControllerEvent = { type: string; key?: string; [key: string]: unknown };
/** Serializes decisions and checks the exact observation again before sending. */
export class DecisionController {
  private busy = false;
  private disposed = false;
  private sent = new Set<string>();
  private failedKey?: string;
  private pendingRequest?: string;
  private observationError?: string;
  constructor(private options: {
    current: () => DecisionInput | null;
    decide: (input: DecisionInput, assertCurrent: () => Promise<void>) => Promise<{ selected: RuntimeAction }>;
    send: (action: RuntimeAction, input: DecisionInput) => void;
    event: (event: ControllerEvent) => void;
  }) {}
  dispose() { this.disposed = true; }
  retry() { this.failedKey = undefined; void this.pump(); }
  rejected() { this.pendingRequest = undefined; }
  private current(): DecisionInput | null {
    try { const input = this.options.current(); this.observationError = undefined; return input; }
    catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid battle observation';
      if (message !== this.observationError) this.options.event({ type: 'recoverable-error', message });
      this.observationError = message;
      return null;
    }
  }
  private requestId(input: DecisionInput): string {
    const request = input.requestIdentity ?? input.state.request as { battleId?: string; rqid?: number; ourSide?: string } | undefined;
    return request?.rqid === undefined ? input.key : JSON.stringify([request.battleId, request.ourSide, request.rqid]);
  }
  async pump(): Promise<void> {
    if (this.busy || this.disposed) return;
    const input = this.current();
    if (!input || this.sent.has(input.key) || this.failedKey === input.key || this.pendingRequest === this.requestId(input)) return;
    this.busy = true;
    const assertCurrent = async () => {
      if (this.disposed || this.current()?.key !== input.key) throw new Error('STALE_DECISION');
    };
    try {
      this.options.event({ type: 'preparing', key: input.key, phase: input.phase, candidates: input.candidates.length });
      const result = await this.options.decide(input, assertCurrent);
      await assertCurrent();
      if (!input.candidates.some(a => a.id === result.selected.id && a.command === result.selected.command)) throw new Error('Unknown selected action');
      this.options.event({ type: 'recommendation', key: input.key, actionId: result.selected.id });
      // Mark before transport invocation: repeated notifications cannot duplicate a command.
      this.sent.add(input.key);
      this.pendingRequest = this.requestId(input);
      this.options.send(result.selected, input);
      this.options.event({ type: 'sent', key: input.key, actionId: result.selected.id });
    } catch (error) {
      const stale = this.disposed || this.current()?.key !== input.key;
      if (!stale) this.failedKey = input.key;
      // A transport failure is recoverable; no acknowledgement has been assumed.
      if (!stale) { this.sent.delete(input.key); this.pendingRequest = undefined; }
      const detail = error instanceof Error ? error.message : 'Unknown failure';
      const secret = process.env.TYPESAFE_API_KEY;
      this.options.event({ type: stale ? 'discarded-stale' : 'recoverable-error', key: input.key,
        message: secret ? detail.split(secret).join('[REDACTED]') : detail });
    } finally {
      this.busy = false;
      if (!this.disposed && this.current()?.key !== input.key) void this.pump();
    }
  }
}
