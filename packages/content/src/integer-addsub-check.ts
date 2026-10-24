import type { MathCheckReason } from './math-check';

/**
 * Deterministic signed-integer add/subtract oracle (Ontario Grade 7 B2 /
 * exp B2.4: represent, describe, and solve situations involving addition and
 * subtraction of integers). a ± b over the integers, computed exactly and
 * graded by VALUE (including negative results). No model.
 *
 * This is a DISTINCT kind from the Grade 6 `integer_signed_compare` oracle
 * (which only orders two integers) and from the Grade 1 non-negative
 * `integer_addition`/`integer_subtraction` fact oracles — none of their
 * guarantees are widened: this kind admits negative operands and negative
 * results, which those do not.
 *
 * Fail-closed on range: both operands are integers in [-100, 100] and the
 * operation is '+' or '-'; the claimed result must be an integer. Anything else
 * is MALFORMED.
 */

export type IntegerAddSubOp = '+' | '-';

const inRange = (n: number): boolean => Number.isInteger(n) && n >= -100 && n <= 100;

export interface IntegerAddSubTask {
  readonly kind: 'integer_addsub_signed';
  readonly left: number;
  readonly right: number;
  readonly op: IntegerAddSubOp;
  readonly claimedResult: number;
}

export interface IntegerAddSubCheckResult {
  readonly correct: boolean;
  readonly ran: boolean;
  readonly reason: MathCheckReason;
}

export function integerAddSubResult(left: number, right: number, op: IntegerAddSubOp): number {
  return op === '+' ? left + right : left - right;
}

export function checkIntegerAddSubTask(task: IntegerAddSubTask): IntegerAddSubCheckResult {
  if (task.kind !== 'integer_addsub_signed') {
    return { correct: false, ran: false, reason: 'UNSUPPORTED_TASK' };
  }
  if (
    !inRange(task.left) ||
    !inRange(task.right) ||
    (task.op !== '+' && task.op !== '-') ||
    !Number.isInteger(task.claimedResult)
  ) {
    return { correct: false, ran: false, reason: 'MALFORMED_TASK' };
  }
  const correct = task.claimedResult === integerAddSubResult(task.left, task.right, task.op);
  return { correct, ran: true, reason: correct ? 'ANSWER_KEY_CORRECT' : 'ANSWER_KEY_WRONG' };
}
