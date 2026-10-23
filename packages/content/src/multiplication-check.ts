import type { MathCheckReason } from './math-check';

/**
 * Deterministic integer-multiplication oracle (Ontario Grade 3 B2.4/B2.3: recall
 * and represent multiplication facts up to 10 × 10). Closed and rule-decidable:
 * the product is computed exactly and verified before delivery, and a learner
 * answer is graded without a model.
 *
 * Fail-closed on range: both factors are non-negative whole numbers within the
 * Grade 3 fact table (0–10) and the claimed product is an integer — anything
 * else (a factor over 10, a negative, a non-integer) is MALFORMED and never
 * delivered. The array/equal-groups REPRESENTATION of B2.4 is the educator's to
 * author; this oracle covers only the numeric fact.
 */

export interface IntegerMultiplicationTask {
  readonly kind: 'integer_multiplication';
  readonly a: number;
  readonly b: number;
  /** The claimed product (an answer key, or a learner's answer). */
  readonly claimedProduct: number;
}

export interface MultiplicationCheckResult {
  readonly correct: boolean;
  readonly ran: boolean;
  readonly reason: MathCheckReason;
}

const isFactor = (n: number): boolean => Number.isInteger(n) && n >= 0 && n <= 10;

export function checkMultiplicationTask(
  task: IntegerMultiplicationTask,
): MultiplicationCheckResult {
  if (task.kind !== 'integer_multiplication') {
    return { correct: false, ran: false, reason: 'UNSUPPORTED_TASK' };
  }
  if (!isFactor(task.a) || !isFactor(task.b) || !Number.isInteger(task.claimedProduct)) {
    return { correct: false, ran: false, reason: 'MALFORMED_TASK' };
  }
  const correct = task.a * task.b === task.claimedProduct;
  return { correct, ran: true, reason: correct ? 'ANSWER_KEY_CORRECT' : 'ANSWER_KEY_WRONG' };
}
