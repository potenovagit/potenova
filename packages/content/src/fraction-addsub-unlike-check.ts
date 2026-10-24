import type { FractionOp, FractionAddSubCheckResult } from './fraction-addsub-check';

/**
 * Deterministic UNLIKE-denominator fraction add/subtract oracle (Ontario Grade 6
 * B2 / exp 10: add and subtract fractions with unlike denominators). The two
 * fractions have different denominators b and d, so
 *   a/b ± c/d = (a·d ± c·b) / (b·d),
 * computed by exact integer arithmetic. The learner's answer is graded by VALUE
 * (cross-multiplication), so any equivalent form — unsimplified (10/12), a
 * common-denominator form, or the fully reduced form — is accepted. No model.
 *
 * This is a DISTINCT kind from the Grade 5 `fraction_addsub_like` oracle, which
 * stays byte-identical: its fail-closed guarantee (a single shared denominator)
 * is never widened here. This oracle instead REQUIRES the two denominators to
 * differ, so a like-denominator item cannot leak into the G6 skill.
 *
 * Fail-closed on range (MALFORMED otherwise): both denominators are whole
 * numbers in [2, 12] and MUST differ (leftDenom !== rightDenom); both numerators
 * are non-negative whole numbers no greater than their own denominator (proper
 * fractions); the result is non-negative (subtraction stays within whole
 * fractions); and the claimed numerator/denominator are integers with a positive
 * denominator.
 */

const isNonNegInt = (n: number): boolean => Number.isInteger(n) && n >= 0;
const isDenomInRange = (n: number): boolean => Number.isInteger(n) && n >= 2 && n <= 12;

export interface FractionAddSubUnlikeTask {
  readonly kind: 'fraction_addsub_unlike';
  readonly leftNum: number;
  readonly leftDenom: number;
  readonly rightNum: number;
  readonly rightDenom: number;
  readonly op: FractionOp;
  readonly claimedNum: number;
  readonly claimedDenom: number;
}

/**
 * The result as {num, denom} over the common denominator leftDenom·rightDenom,
 * or null if the operation would make the value negative.
 */
export function fractionAddSubUnlikeResult(
  leftNum: number,
  leftDenom: number,
  rightNum: number,
  rightDenom: number,
  op: FractionOp,
): { num: number; denom: number } | null {
  const denom = leftDenom * rightDenom;
  const crossLeft = leftNum * rightDenom;
  const crossRight = rightNum * leftDenom;
  const num = op === '+' ? crossLeft + crossRight : crossLeft - crossRight;
  return num >= 0 ? { num, denom } : null;
}

export function checkFractionAddSubUnlikeTask(
  task: FractionAddSubUnlikeTask,
): FractionAddSubCheckResult {
  if (task.kind !== 'fraction_addsub_unlike') {
    return { correct: false, ran: false, reason: 'UNSUPPORTED_TASK' };
  }
  const wellPosed =
    isDenomInRange(task.leftDenom) &&
    isDenomInRange(task.rightDenom) &&
    task.leftDenom !== task.rightDenom &&
    isNonNegInt(task.leftNum) &&
    isNonNegInt(task.rightNum) &&
    task.leftNum <= task.leftDenom &&
    task.rightNum <= task.rightDenom &&
    (task.op === '+' || task.op === '-') &&
    isNonNegInt(task.claimedNum) &&
    Number.isInteger(task.claimedDenom) &&
    task.claimedDenom > 0;
  if (!wellPosed) return { correct: false, ran: false, reason: 'MALFORMED_TASK' };
  const result = fractionAddSubUnlikeResult(
    task.leftNum,
    task.leftDenom,
    task.rightNum,
    task.rightDenom,
    task.op,
  );
  if (result === null) return { correct: false, ran: false, reason: 'MALFORMED_TASK' };
  // value equality: result.num/result.denom == claimedNum/claimedDenom (cross-multiply, exact)
  const correct = result.num * task.claimedDenom === task.claimedNum * result.denom;
  return { correct, ran: true, reason: correct ? 'ANSWER_KEY_CORRECT' : 'ANSWER_KEY_WRONG' };
}
