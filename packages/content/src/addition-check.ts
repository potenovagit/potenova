import type { MathCheckReason } from './math-check';

/**
 * Deterministic integer-addition oracle — a second Math strand (number sense)
 * alongside fractions, to show the engine scales past one strand per subject.
 * Closed and rule-decidable: the sum is verified independently before delivery
 * and a learner answer is graded without a model.
 */

export interface IntegerAdditionTask {
  readonly kind: 'integer_addition';
  readonly a: number;
  readonly b: number;
  /** The claimed sum (an answer key, or a learner's answer). */
  readonly claimedSum: number;
}

export interface AdditionCheckResult {
  readonly correct: boolean;
  readonly ran: boolean;
  readonly reason: MathCheckReason;
}

const isNonNegInt = (n: number): boolean => Number.isInteger(n) && n >= 0;

export function checkAdditionTask(task: IntegerAdditionTask): AdditionCheckResult {
  if (task.kind !== 'integer_addition') {
    return { correct: false, ran: false, reason: 'UNSUPPORTED_TASK' };
  }
  if (!isNonNegInt(task.a) || !isNonNegInt(task.b) || !Number.isInteger(task.claimedSum)) {
    return { correct: false, ran: false, reason: 'MALFORMED_TASK' };
  }
  const correct = task.a + task.b === task.claimedSum;
  return { correct, ran: true, reason: correct ? 'ANSWER_KEY_CORRECT' : 'ANSWER_KEY_WRONG' };
}
