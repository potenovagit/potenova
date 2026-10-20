import { describe, it, expect } from 'vitest';
import { DomainError } from '@potenova/contracts';
import { boundedGenerate } from '../src/invoke';
import type { GenerativeProvider, GenerativeResult } from '../src/generation';

/**
 * Bounded, fallback-safe AI invocation (AI-015): retries are bounded and only
 * for transient failures, cost is capped, and exhaustion never throws — it
 * falls back so a child is never stranded.
 */

function provider(behaviour: () => Promise<GenerativeResult>): GenerativeProvider {
  return { id: 'p', region: 'ca-central', generate: behaviour };
}
const ok = (units = 5): GenerativeResult => ({ text: '{"answer":"gt"}', model: 'p', units });
const transient = () => new DomainError('DEPENDENCY_UNAVAILABLE', 'down');

describe('boundedGenerate (AI-015)', () => {
  it('returns OK on first success, one attempt', async () => {
    const out = await boundedGenerate(
      provider(async () => ok(5)),
      { prompt: 'x' },
    );
    expect(out.kind).toBe('OK');
    if (out.kind === 'OK') {
      expect(out.attempts).toBe(1);
      expect(out.units).toBe(5);
    }
  });

  it('retries a transient failure (bounded) and recovers', async () => {
    let n = 0;
    const out = await boundedGenerate(
      provider(async () => {
        n++;
        if (n < 3) throw transient();
        return ok(7);
      }),
      { prompt: 'x' },
      { maxAttempts: 3 },
    );
    expect(out.kind).toBe('OK');
    if (out.kind === 'OK') expect(out.attempts).toBe(3);
  });

  it('falls back (never throws) when transient retries are exhausted', async () => {
    let n = 0;
    const out = await boundedGenerate(
      provider(async () => {
        n++;
        throw transient();
      }),
      { prompt: 'x' },
      { maxAttempts: 3 },
    );
    expect(out.kind).toBe('FALLBACK');
    if (out.kind === 'FALLBACK') {
      expect(out.reason).toBe('attempts_exhausted');
      expect(out.attempts).toBe(3);
    }
    expect(n).toBe(3); // bounded — did not spin
  });

  it('does NOT retry a non-transient (fail-closed) error — falls back at once', async () => {
    let n = 0;
    const out = await boundedGenerate(
      provider(async () => {
        n++;
        throw new DomainError('POLICY_BLOCKED', 'nope');
      }),
      { prompt: 'x' },
      { maxAttempts: 5 },
    );
    expect(out.kind).toBe('FALLBACK');
    if (out.kind === 'FALLBACK') {
      expect(out.reason).toBe('non_retryable');
      expect(out.code).toBe('POLICY_BLOCKED');
      expect(out.attempts).toBe(1);
    }
    expect(n).toBe(1);
  });

  it('falls back when a response exceeds the per-operation unit ceiling', async () => {
    const out = await boundedGenerate(
      provider(async () => ok(9999)),
      { prompt: 'x' },
      { maxUnits: 100 },
    );
    expect(out.kind).toBe('FALLBACK');
    if (out.kind === 'FALLBACK') expect(out.reason).toBe('unit_ceiling');
  });
});
