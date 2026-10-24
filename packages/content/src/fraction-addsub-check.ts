import type { MathCheckReason } from './math-check';

/**
 * Deterministic like-denominator fraction add/subtract oracle (Ontario Grade 5
 * B2 / exp 11: add and subtract fractions with like denominators). Both
 * fractions share a denominator d, so p/d ± q/d = (p ± q)/d. Closed and
 * rule-decidable: computed by exact integer arithmetic and the learner's answer
 * is graded by VALUE (cross-multiplication), so an equivalent form (e.g. 2/4 for
 * 1/2) is accepted. No model.
 *
 * Fail-closed on range: the shared denominator is a whole number in [2, 12]
 * (Grade 5 works to twelfths), both numerators are non-negative whole numbers no
 * greater than the denominator (proper fractions), the result is non-negative
 * (subtraction stays within whole fractions), and the claimed numerator/
 * denominator are integers with a positive denominator. Anything else is
 * MALFORMED.
 */

export type FractionOp = '+' | '-';

const isNonNegInt = (n: number): boolean => Number.isInteger(n) && n >= 0;

export interface FractionAddSubLikeTask {
  readonly kind: 'fraction_addsub_like';
  readonly leftNum: number;
  readonly rightNum: number;
  readonly denom: number;
  readonly op: FractionOp;
  readonly claimedNum: number;
  readonly claimedDenom: number;
}

export interface FractionAddSubCheckResult {
  readonly correct: boolean;
  readonly ran: boolean;
  readonly reason: MathCheckReason;
}

/** The resulting numerator over the shared denominator, or null if out of range. */
export function fractionAddSubResultNum(
  leftNum: number,
  rightNum: number,
  op: FractionOp,
): number | null {
  const v = op === '+' ? leftNum + rightNum : leftNum - rightNum;
  return v >= 0 ? v : null;
}

export function checkFractionAddSubLikeTask(
  task: FractionAddSubLikeTask,
): FractionAddSubCheckResult {
  if (task.kind !== 'fraction_addsub_like') {
    return { correct: false, ran: false, reason: 'UNSUPPORTED_TASK' };
  }
  const wellPosed =
    Number.isInteger(task.denom) &&
    task.denom >= 2 &&
    task.denom <= 12 &&
    isNonNegInt(task.leftNum) &&
    isNonNegInt(task.rightNum) &&
    task.leftNum <= task.denom &&
    task.rightNum <= task.denom &&
    (task.op === '+' || task.op === '-') &&
    isNonNegInt(task.claimedNum) &&
    Number.isInteger(task.claimedDenom) &&
    task.claimedDenom > 0;
  if (!wellPosed) return { correct: false, ran: false, reason: 'MALFORMED_TASK' };
  const resultNum = fractionAddSubResultNum(task.leftNum, task.rightNum, task.op);
  if (resultNum === null) return { correct: false, ran: false, reason: 'MALFORMED_TASK' };
  // value equality: resultNum/denom == claimedNum/claimedDenom  (cross-multiply, exact)
  const correct = resultNum * task.claimedDenom === task.claimedNum * task.denom;
  return { correct, ran: true, reason: correct ? 'ANSWER_KEY_CORRECT' : 'ANSWER_KEY_WRONG' };
}
