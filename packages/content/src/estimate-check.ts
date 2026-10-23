import type { MathCheckReason } from './math-check';

/**
 * Deterministic estimation oracle (Ontario Grade 1 B1.4: estimate the number in
 * a collection, then verify by counting). Estimation has no single right answer,
 * so correctness is membership in a REVIEWED tolerance band [low, high] that an
 * educator sets around the true count — not a value the engine invents. The band
 * is the answer key; the oracle only checks the learner's estimate falls inside
 * it, with no model.
 *
 * Fail-closed / well-posedness: the actual count and the band bounds are
 * non-negative whole numbers, the band is ordered (low <= high), and the band
 * actually brackets the true count (low <= actual <= high) — an item whose
 * reviewed band excludes the real answer is MALFORMED and never delivered.
 */

export interface EstimateTask {
  readonly kind: 'estimate_within_band';
  /** The true count of the collection shown (used to present and to sanity-check the band). */
  readonly actual: number;
  /** Educator-reviewed acceptable range, inclusive. */
  readonly low: number;
  readonly high: number;
  /** The learner's (or a key's) estimate. */
  readonly claimed: number;
}

export interface EstimateCheckResult {
  readonly correct: boolean;
  readonly ran: boolean;
  readonly reason: MathCheckReason;
}

const isNonNegInt = (n: number): boolean => Number.isInteger(n) && n >= 0;

export function checkEstimateTask(task: EstimateTask): EstimateCheckResult {
  if (task.kind !== 'estimate_within_band') {
    return { correct: false, ran: false, reason: 'UNSUPPORTED_TASK' };
  }
  const wellPosed =
    isNonNegInt(task.actual) &&
    isNonNegInt(task.low) &&
    isNonNegInt(task.high) &&
    task.low <= task.high &&
    task.low <= task.actual &&
    task.actual <= task.high &&
    Number.isInteger(task.claimed);
  if (!wellPosed) return { correct: false, ran: false, reason: 'MALFORMED_TASK' };
  const correct = task.claimed >= task.low && task.claimed <= task.high;
  return { correct, ran: true, reason: correct ? 'ANSWER_KEY_CORRECT' : 'ANSWER_KEY_WRONG' };
}
