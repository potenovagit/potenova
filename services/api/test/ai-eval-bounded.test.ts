import { describe, it, expect, afterEach } from 'vitest';
import { createApp } from '../src/app';
import { openDatabase, AiUsageRepository, type PotenovaDb } from '@potenova/persistence';
import { DomainError } from '@potenova/contracts';
import type { GenerativeProvider, GenerativeResult } from '@potenova/ai-gateway';

/**
 * AI-015 at the eval route: a candidate call is bounded + fallback-safe. A
 * transient failure is retried within bounds; persistent failure ends in a
 * contained FALLBACK (never a 5xx that would strand a child), and the operation
 * records usage exactly once however many attempts it took (idempotent).
 */

const env = { APP_ENV: 'staging', PRIMARY_REGION: 'ca-central', DR_REGION: 'ca-east' };
const operator = { 'x-actor-type': 'operator', 'x-actor-alias': 'op1' };

let dbs: PotenovaDb[] = [];
function appWith(provider: GenerativeProvider) {
  const db = openDatabase();
  dbs.push(db);
  return { app: createApp({ env, db, aiProvider: provider }), db };
}
afterEach(async () => {
  await Promise.all(dbs.map((d) => d.close()));
  dbs = [];
});
const post = (h: Record<string, string>, body: unknown = {}) => ({
  method: 'POST',
  headers: { 'content-type': 'application/json', ...h },
  body: JSON.stringify(body),
});

const okAnswer = '{"answer":"gt","explanation":"1/2 > 1/3"}';

/** Fails transiently `failures` times, then returns a valid answer. */
class FlakyProvider implements GenerativeProvider {
  readonly id = 'azure-openai:tutor-mini';
  readonly region = 'ca-central';
  calls = 0;
  constructor(private readonly failures: number) {}
  async generate(): Promise<GenerativeResult> {
    this.calls++;
    if (this.calls <= this.failures) throw new DomainError('DEPENDENCY_UNAVAILABLE', 'down');
    return { text: okAnswer, model: this.id, units: 5 };
  }
}

describe('bounded + fallback-safe candidate eval (AI-015)', () => {
  it('retries a transient failure and recovers within bounds', async () => {
    const provider = new FlakyProvider(2); // fail twice, succeed on the 3rd
    const { app } = appWith(provider);
    const res = await app.request('/operator/model-eval', post(operator));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.delivery).not.toBe('FALLBACK');
    expect(body.attempts).toBe(3);
    expect(provider.calls).toBe(3);
  });

  it('a persistently failing model falls back (200, contained) — never a 5xx that strands', async () => {
    const provider = new FlakyProvider(99); // always fails
    const { app, db } = appWith(provider);
    const res = await app.request('/operator/model-eval', post(operator));
    expect(res.status).toBe(200); // NOT 503
    const body = await res.json();
    expect(body.delivery).toBe('FALLBACK');
    expect(body.deliveredToChild).toBe(false);
    expect(body.reasonCodes).toContain('attempts_exhausted');
    // Bounded: it did not spin — exactly the attempt cap.
    expect(provider.calls).toBe(3);
    // Idempotent side effects: one usage event recorded for the one operation.
    const usage = await new AiUsageRepository(db).summary();
    expect(usage.events).toBe(1);
  });

  it('records a single usage event for a recovered (multi-attempt) operation', async () => {
    const { app, db } = appWith(new FlakyProvider(1));
    await app.request('/operator/model-eval', post(operator));
    const usage = await new AiUsageRepository(db).summary();
    expect(usage.events).toBe(1); // one op → one event, despite the retry
    expect(usage.totalUnits).toBe(5);
  });
});
