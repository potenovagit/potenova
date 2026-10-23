import type { MathCheckReason } from './math-check';

/**
 * Deterministic multi-digit multiplication oracle (Ontario Grade 4 B2 / exp 13:
 * multiply two- or three-digit whole numbers by one-digit whole numbers and by
 * 10, 100, and 1000). Closed and rule-decidable: the product is computed exactly
 * and graded without a model.
 *
 * This is a DISTINCT task kind from the Grade 3 `integer_multiplication` fact
 * oracle (factors 0–10), which is left byte-identical — multi-digit computation
 * is a different skill from fact recall and rides its own kind, not a widened
 * factor bound.
 *
 * Fail-closed on range: the multiplicand is a non-negative whole number no
 * greater than 9999, the multiplier is a one-digit factor (1–9) OR a power of
 * ten (10, 100, 1000), and the claimed product is an integer. Anything else is
 * MALFORMED.
 */

const POWERS_OF_TEN = new Set<number>([10, 100, 1000]);

export interface MultidigitMultiplicationTask {
  readonly kind: 'multidigit_multiplication';
  readonly multiplicand: number;
  readonly multiplier: number;
  /** The claimed product (an answer key, or a learner's answer). */
  readonly claimedProduct: number;
}

export interface MultidigitMultiplicationCheckResult {
  readonly correct: boolean;
  readonly ran: boolean;
  readonly reason: MathCheckReason;
}

const isNonNegInt = (n: number): boolean => Number.isInteger(n) && n >= 0;
const isAllowedMultiplier = (n: number): boolean =>
  (Number.isInteger(n) && n >= 1 && n <= 9) || POWERS_OF_TEN.has(n);

export function checkMultidigitMultiplicationTask(
  task: MultidigitMultiplicationTask,
): MultidigitMultiplicationCheckResult {
  if (task.kind !== 'multidigit_multiplication') {
    return { correct: false, ran: false, reason: 'UNSUPPORTED_TASK' };
  }
  if (
    !isNonNegInt(task.multiplicand) ||
    task.multiplicand > 9999 ||
    !isAllowedMultiplier(task.multiplier) ||
    !Number.isInteger(task.claimedProduct)
  ) {
    return { correct: false, ran: false, reason: 'MALFORMED_TASK' };
  }
  const correct = task.multiplicand * task.multiplier === task.claimedProduct;
  return { correct, ran: true, reason: correct ? 'ANSWER_KEY_CORRECT' : 'ANSWER_KEY_WRONG' };
}
