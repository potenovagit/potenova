import type { MathCheckReason } from './math-check';

/**
 * Deterministic integer-subtraction oracle — the counterpart to the addition
 * oracle in the number-sense strand (Ontario Grade 1 B2.2/B2.3: related
 * subtraction facts within 10 and within 20). Closed and rule-decidable: the
 * difference is verified independently before delivery and a learner answer is
 * graded without a model.
 *
 * Fail-closed on range: subtraction is restricted to whole-number results, so a
 * task where the subtrahend exceeds the minuend (a negative difference) is
 * MALFORMED, never silently accepted — Grade 1 facts stay within [0, a].
 */

export interface IntegerSubtractionTask {
  readonly kind: 'integer_subtraction';
  readonly a: number;
  readonly b: number;
  /** The claimed difference (an answer key, or a learner's answer). */
  readonly claimedDifference: number;
}

export interface SubtractionCheckResult {
  readonly correct: boolean;
  readonly ran: boolean;
  readonly reason: MathCheckReason;
}

const isNonNegInt = (n: number): boolean => Number.isInteger(n) && n >= 0;

export function checkSubtractionTask(task: IntegerSubtractionTask): SubtractionCheckResult {
  if (task.kind !== 'integer_subtraction') {
    return { correct: false, ran: false, reason: 'UNSUPPORTED_TASK' };
  }
  // Both operands non-negative integers, the minuend at least the subtrahend
  // (whole-number result), and a well-formed integer claim — otherwise MALFORMED.
  if (
    !isNonNegInt(task.a) ||
    !isNonNegInt(task.b) ||
    task.b > task.a ||
    !Number.isInteger(task.claimedDifference)
  ) {
    return { correct: false, ran: false, reason: 'MALFORMED_TASK' };
  }
  const correct = task.a - task.b === task.claimedDifference;
  return { correct, ran: true, reason: correct ? 'ANSWER_KEY_CORRECT' : 'ANSWER_KEY_WRONG' };
}
