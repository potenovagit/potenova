import type { MathCheckReason } from './math-check';

/**
 * Deterministic integer-division oracle (Ontario Grade 3 B2.3/B2.4: recall the
 * division facts related to the 2, 5 and 10 times tables, and represent division
 * up to 100 ÷ 10). Closed and rule-decidable: the quotient is computed exactly
 * and verified before delivery, and a learner answer is graded without a model.
 *
 * Grade 3 division facts are EXACT — no remainders — so the oracle is
 * fail-closed on a zero divisor, a dividend that the divisor does not divide
 * evenly, a dividend over 100 or a divisor over 10, a negative, or a
 * non-integer claim. Anything of those is MALFORMED and never delivered. The
 * fair-share / array REPRESENTATION of B2.4 is the educator's to author; this
 * oracle covers only the numeric fact.
 */

export interface IntegerDivisionTask {
  readonly kind: 'integer_division';
  readonly dividend: number;
  readonly divisor: number;
  /** The claimed quotient (an answer key, or a learner's answer). */
  readonly claimedQuotient: number;
}

export interface DivisionCheckResult {
  readonly correct: boolean;
  readonly ran: boolean;
  readonly reason: MathCheckReason;
}

const isNonNegInt = (n: number): boolean => Number.isInteger(n) && n >= 0;

export function checkDivisionTask(task: IntegerDivisionTask): DivisionCheckResult {
  if (task.kind !== 'integer_division') {
    return { correct: false, ran: false, reason: 'UNSUPPORTED_TASK' };
  }
  const wellPosed =
    isNonNegInt(task.dividend) &&
    isNonNegInt(task.divisor) &&
    task.divisor >= 1 &&
    task.divisor <= 10 &&
    task.dividend <= 100 &&
    task.dividend % task.divisor === 0 &&
    Number.isInteger(task.claimedQuotient);
  if (!wellPosed) return { correct: false, ran: false, reason: 'MALFORMED_TASK' };
  const correct = task.dividend / task.divisor === task.claimedQuotient;
  return { correct, ran: true, reason: correct ? 'ANSWER_KEY_CORRECT' : 'ANSWER_KEY_WRONG' };
}
