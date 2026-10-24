import type { MathCheckReason } from './math-check';

/**
 * Deterministic 3-digit ÷ 2-digit division-with-remainder oracle (Ontario Grade
 * 5 B2 / exp 13: divide three-digit whole numbers by two-digit whole numbers).
 * The learner gives BOTH the whole-number quotient and the remainder. Closed and
 * rule-decidable: quotient and remainder are computed exactly
 * (q = ⌊dividend / divisor⌋, r = dividend mod divisor) and graded without a model.
 *
 * This is a DISTINCT task kind from the Grade 4 `division_with_remainder` oracle
 * (one-digit divisor), which is left byte-identical — a two-digit divisor is a
 * different skill and rides its own kind, not a widened divisor bound.
 *
 * Fail-closed on range: the dividend is a whole number in [100, 999], the
 * divisor is a two-digit whole number in [10, 99], and the claimed quotient and
 * remainder are integers. Anything else is MALFORMED.
 */

export interface Division2DigitTask {
  readonly kind: 'division_2digit';
  readonly dividend: number;
  readonly divisor: number;
  readonly claimedQuotient: number;
  readonly claimedRemainder: number;
}

export interface Division2DigitCheckResult {
  readonly correct: boolean;
  readonly ran: boolean;
  readonly reason: MathCheckReason;
}

export function checkDivision2DigitTask(task: Division2DigitTask): Division2DigitCheckResult {
  if (task.kind !== 'division_2digit') {
    return { correct: false, ran: false, reason: 'UNSUPPORTED_TASK' };
  }
  const wellPosed =
    Number.isInteger(task.dividend) &&
    task.dividend >= 100 &&
    task.dividend <= 999 &&
    Number.isInteger(task.divisor) &&
    task.divisor >= 10 &&
    task.divisor <= 99 &&
    Number.isInteger(task.claimedQuotient) &&
    Number.isInteger(task.claimedRemainder);
  if (!wellPosed) return { correct: false, ran: false, reason: 'MALFORMED_TASK' };
  const quotient = Math.floor(task.dividend / task.divisor);
  const remainder = task.dividend % task.divisor;
  const correct = task.claimedQuotient === quotient && task.claimedRemainder === remainder;
  return { correct, ran: true, reason: correct ? 'ANSWER_KEY_CORRECT' : 'ANSWER_KEY_WRONG' };
}
