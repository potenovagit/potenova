import type { MathCheckReason } from './math-check';

/**
 * Deterministic signed-integer multiply/divide oracle (Ontario Grade 8 B2 /
 * exp B2.7: multiply and divide integers). a × b and a ÷ b over the integers,
 * computed exactly with the usual sign rules, graded by VALUE (including
 * negative results). No model.
 *
 * A DISTINCT kind from the Grade 7 `integer_addsub_signed` oracle (addition and
 * subtraction only) — neither widens the other. Fail-closed on range: both
 * operands are integers in [-144, 144]; for division the divisor must be
 * non-zero AND must divide the dividend exactly (the rule-decidable slice stays
 * in whole-number quotients — 7 ÷ 2 is MALFORMED and never reaches a child). The
 * claimed result must be an integer. Anything else is MALFORMED.
 */

export type IntegerMulDivOp = '×' | '÷';

const inRange = (n: number): boolean => Number.isInteger(n) && n >= -144 && n <= 144;

export interface IntegerMulDivTask {
  readonly kind: 'integer_muldiv_signed';
  readonly left: number;
  readonly right: number;
  readonly op: IntegerMulDivOp;
  readonly claimedResult: number;
}

export interface IntegerMulDivCheckResult {
  readonly correct: boolean;
  readonly ran: boolean;
  readonly reason: MathCheckReason;
}

/** a op b as an exact integer, or null when undefined / non-integer (÷). */
export function integerMulDivResult(
  left: number,
  right: number,
  op: IntegerMulDivOp,
): number | null {
  if (op === '×') return left * right;
  // division: undefined by zero, and only admitted when it divides exactly
  if (right === 0 || left % right !== 0) return null;
  return left / right;
}

export function checkIntegerMulDivTask(task: IntegerMulDivTask): IntegerMulDivCheckResult {
  if (task.kind !== 'integer_muldiv_signed') {
    return { correct: false, ran: false, reason: 'UNSUPPORTED_TASK' };
  }
  if (
    !inRange(task.left) ||
    !inRange(task.right) ||
    (task.op !== '×' && task.op !== '÷') ||
    !Number.isInteger(task.claimedResult)
  ) {
    return { correct: false, ran: false, reason: 'MALFORMED_TASK' };
  }
  const result = integerMulDivResult(task.left, task.right, task.op);
  if (result === null) return { correct: false, ran: false, reason: 'MALFORMED_TASK' };
  const correct = task.claimedResult === result;
  return { correct, ran: true, reason: correct ? 'ANSWER_KEY_CORRECT' : 'ANSWER_KEY_WRONG' };
}
