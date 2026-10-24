import type { FractionAddSubCheckResult } from './fraction-addsub-check';

/**
 * Deterministic fraction multiply/divide oracle (Ontario Grade 7 B2 / exp B2.8:
 * multiply and divide fractions by fractions). Exact integer arithmetic, graded
 * by VALUE (cross-multiplication), so any equivalent form of the answer is
 * accepted (unsimplified or reduced). No model.
 *
 *   (a/b) × (c/d) = (a·c) / (b·d)
 *   (a/b) ÷ (c/d) = (a·d) / (b·c)   — "multiply by the reciprocal"
 *
 * A DISTINCT kind from every earlier fraction oracle (G5 like-denominator
 * add/subtract, G6 unlike-denominator add/subtract): none of their guarantees
 * are widened. Fail-closed on range: denominators are whole numbers in [2, 12],
 * numerators non-negative whole numbers no greater than their denominator
 * (proper fractions). For division the divisor numerator must be > 0 (no divide
 * by zero). The claimed numerator/denominator must be integers with a positive
 * denominator. Anything else is MALFORMED.
 */

export type FractionMulDivOp = '×' | '÷';

const isNonNegInt = (n: number): boolean => Number.isInteger(n) && n >= 0;
const isDenomInRange = (n: number): boolean => Number.isInteger(n) && n >= 2 && n <= 12;

export interface FractionMulDivTask {
  readonly kind: 'fraction_muldiv';
  readonly leftNum: number;
  readonly leftDenom: number;
  readonly rightNum: number;
  readonly rightDenom: number;
  readonly op: FractionMulDivOp;
  readonly claimedNum: number;
  readonly claimedDenom: number;
}

/** The result as {num, denom}, or null if the operation is undefined (÷ by 0). */
export function fractionMulDivResult(
  leftNum: number,
  leftDenom: number,
  rightNum: number,
  rightDenom: number,
  op: FractionMulDivOp,
): { num: number; denom: number } | null {
  if (op === '×') {
    return { num: leftNum * rightNum, denom: leftDenom * rightDenom };
  }
  // division: multiply by the reciprocal; undefined when the divisor is zero
  if (rightNum === 0) return null;
  return { num: leftNum * rightDenom, denom: leftDenom * rightNum };
}

export function checkFractionMulDivTask(task: FractionMulDivTask): FractionAddSubCheckResult {
  if (task.kind !== 'fraction_muldiv') {
    return { correct: false, ran: false, reason: 'UNSUPPORTED_TASK' };
  }
  const wellPosed =
    isDenomInRange(task.leftDenom) &&
    isDenomInRange(task.rightDenom) &&
    isNonNegInt(task.leftNum) &&
    isNonNegInt(task.rightNum) &&
    task.leftNum <= task.leftDenom &&
    task.rightNum <= task.rightDenom &&
    (task.op === '×' || task.op === '÷') &&
    isNonNegInt(task.claimedNum) &&
    Number.isInteger(task.claimedDenom) &&
    task.claimedDenom > 0 &&
    // division by zero is undefined — never a well-posed item
    !(task.op === '÷' && task.rightNum === 0);
  if (!wellPosed) return { correct: false, ran: false, reason: 'MALFORMED_TASK' };
  const result = fractionMulDivResult(
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
