import { type ErrorCode, isDomainError } from '@potenova/contracts';
import type { GenerativeProvider, GenerativeRequest, GenerativeResult } from './generation';
import { DRAFT_MAX_GENERATION_ATTEMPTS, DRAFT_MAX_OPERATION_UNITS } from './cost';

/**
 * Bounded, fallback-safe AI invocation (AI-015).
 * Source: AI-015 ("Per-operation cost controls SHALL terminate accidental loops
 * while preserving safe educational fallback. Retries are bounded, idempotent
 * and never strand child mid-diagnostic.").
 *
 * A single AI operation is wrapped so it can never spin or stall a learner:
 *  - retries are BOUNDED (at most `maxAttempts`) and only for TRANSIENT failures
 *    (DEPENDENCY_UNAVAILABLE); a fail-closed policy/region error is never retried;
 *  - cumulative token units are capped (`maxUnits`) so a runaway response stops;
 *  - on exhaustion / ceiling / a non-retryable error it NEVER throws — it returns
 *    a FALLBACK outcome so the caller can deliver a safe, pre-validated item
 *    instead of stranding the child.
 *
 * Idempotence is the caller's contract made easy: the operation yields exactly
 * ONE outcome and reports the total units once, so retries never double-charge
 * or double-deliver — the caller records cost/delivery a single time.
 */

export type BoundedFallbackReason = 'attempts_exhausted' | 'unit_ceiling' | 'non_retryable';

export type BoundedOutcome =
  | {
      readonly kind: 'OK';
      readonly result: GenerativeResult;
      readonly attempts: number;
      readonly units: number;
    }
  | {
      readonly kind: 'FALLBACK';
      readonly reason: BoundedFallbackReason;
      readonly attempts: number;
      readonly units: number;
      readonly code?: ErrorCode;
    };

export interface BoundedGenerateOptions {
  /** Max attempts (≥1). Default DRAFT_MAX_GENERATION_ATTEMPTS. */
  readonly maxAttempts?: number;
  /** Cumulative token-unit ceiling for the operation. Default DRAFT_MAX_OPERATION_UNITS. */
  readonly maxUnits?: number;
}

/** A transient failure is worth a bounded retry; everything else fails closed. */
function isTransient(e: unknown): boolean {
  return isDomainError(e) && e.code === 'DEPENDENCY_UNAVAILABLE';
}

export async function boundedGenerate(
  provider: GenerativeProvider,
  req: GenerativeRequest,
  opts: BoundedGenerateOptions = {},
): Promise<BoundedOutcome> {
  const maxAttempts = Math.max(1, opts.maxAttempts ?? DRAFT_MAX_GENERATION_ATTEMPTS);
  const maxUnits = opts.maxUnits ?? DRAFT_MAX_OPERATION_UNITS;
  let attempts = 0;
  let units = 0;

  while (attempts < maxAttempts) {
    attempts++;
    try {
      const result = await provider.generate(req);
      units += result.units;
      // Per-operation cost control: a response past the ceiling is not delivered.
      if (units > maxUnits) {
        return { kind: 'FALLBACK', reason: 'unit_ceiling', attempts, units };
      }
      return { kind: 'OK', result, attempts, units };
    } catch (e) {
      if (isTransient(e)) continue; // bounded retry
      // Non-retryable (policy / residency / other): stop now, fall back safely.
      return {
        kind: 'FALLBACK',
        reason: 'non_retryable',
        attempts,
        units,
        code: isDomainError(e) ? e.code : 'DEPENDENCY_UNAVAILABLE',
      };
    }
  }
  // Retries exhausted on transient failures — never strand, fall back.
  return {
    kind: 'FALLBACK',
    reason: 'attempts_exhausted',
    attempts,
    units,
    code: 'DEPENDENCY_UNAVAILABLE',
  };
}
