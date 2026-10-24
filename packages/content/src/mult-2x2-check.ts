import type { MathCheckReason } from './math-check';

/**
 * Deterministic two-digit × two-digit multiplication oracle (Ontario Grade 5
 * B2 / exp 12: multiply two-digit whole numbers by two-digit whole numbers).
 * Closed and rule-decidable: the product is computed exactly and graded without
 * a model.
 *
 * This is a DISTINCT task kind from the Grade 4 `multidigit_multiplication`
 * oracle (2–3 digit × one-digit or power of ten), which is left byte-identical —
 * a two-digit multiplier is a different skill (partial products across both
 * places) and rides its own kind, not a widened multiplier bound.
 *
 * Fail-closed on range: both factors are whole numbers in [10, 99], and the
 * claimed product is an integer. Anything else is MALFORMED.
 */

const isTwoDigit = (n: number): boolean => Number.isInteger(n) && n >= 10 && n <= 99;

export interface Mult2x2Task {
  readonly kind: 'mult_2x2';
  readonly factorA: number;
  readonly factorB: number;
  readonly claimedProduct: number;
}

export interface Mult2x2CheckResult {
  readonly correct: boolean;
  readonly ran: boolean;
  readonly reason: MathCheckReason;
}

export function checkMult2x2Task(task: Mult2x2Task): Mult2x2CheckResult {
  if (task.kind !== 'mult_2x2') {
    return { correct: false, ran: false, reason: 'UNSUPPORTED_TASK' };
  }
  if (
    !isTwoDigit(task.factorA) ||
    !isTwoDigit(task.factorB) ||
    !Number.isInteger(task.claimedProduct)
  ) {
    return { correct: false, ran: false, reason: 'MALFORMED_TASK' };
  }
  const correct = task.factorA * task.factorB === task.claimedProduct;
  return { correct, ran: true, reason: correct ? 'ANSWER_KEY_CORRECT' : 'ANSWER_KEY_WRONG' };
}
