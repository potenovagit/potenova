import type { MathCheckReason } from './math-check';

/**
 * Deterministic expression-equivalence oracle for all four operations (Ontario
 * Grade 3 B2.2 / exp 21: determine whether sets of addition, subtraction,
 * multiplication and division expressions are equivalent, e.g. is 4 × 3 the same
 * as 24 ÷ 2?). Closed and rule-decidable: each side is a simple two-operand
 * whole-number expression, both are evaluated exactly, and the learner's yes/no
 * is graded without a model.
 *
 * This is a DISTINCT task kind from the Grade 1 `expr_equivalence` oracle
 * (+/− only), which is left byte-identical — the ×/÷ operators ride their own
 * kind rather than relaxing the Grade 1 "+/− only" fail-closed contract.
 *
 * Fail-closed on range: every operand and BOTH side-values are non-negative
 * whole numbers. A side that would go negative (e.g. 2 − 5), divide by zero, or
 * not divide evenly (e.g. 7 ÷ 2) makes the item MALFORMED — Grade 3 division
 * facts are exact, and the strand stays within whole numbers.
 */

export type ExprMulDivOp = '+' | '-' | '*' | '/';

export interface ExprMulDiv {
  readonly a: number;
  readonly op: ExprMulDivOp;
  readonly b: number;
}

export interface ExprEquivalenceMulDivTask {
  readonly kind: 'expr_equivalence_muldiv';
  readonly left: ExprMulDiv;
  readonly right: ExprMulDiv;
  /** The claimed verdict: are the two sides equal in value? */
  readonly claimedEquivalent: boolean;
}

export interface ExprEquivMulDivCheckResult {
  readonly correct: boolean;
  readonly ran: boolean;
  readonly reason: MathCheckReason;
}

const isNonNegInt = (n: number): boolean => Number.isInteger(n) && n >= 0;

/**
 * Evaluate a simple whole-number expression over +, −, ×, ÷, or null if it is
 * out of range: a bad operator, a non-integer/negative operand, a negative
 * result, a zero divisor, or a non-exact quotient.
 */
export function evalExprMulDiv(e: ExprMulDiv): number | null {
  if (!isNonNegInt(e.a) || !isNonNegInt(e.b)) return null;
  switch (e.op) {
    case '+':
      return e.a + e.b;
    case '-':
      return e.a - e.b >= 0 ? e.a - e.b : null;
    case '*':
      return e.a * e.b;
    case '/':
      if (e.b === 0 || e.a % e.b !== 0) return null;
      return e.a / e.b;
    default:
      return null;
  }
}

export function checkExprEquivalenceMulDivTask(
  task: ExprEquivalenceMulDivTask,
): ExprEquivMulDivCheckResult {
  if (task.kind !== 'expr_equivalence_muldiv') {
    return { correct: false, ran: false, reason: 'UNSUPPORTED_TASK' };
  }
  const lv = evalExprMulDiv(task.left);
  const rv = evalExprMulDiv(task.right);
  if (lv === null || rv === null || typeof task.claimedEquivalent !== 'boolean') {
    return { correct: false, ran: false, reason: 'MALFORMED_TASK' };
  }
  const correct = (lv === rv) === task.claimedEquivalent;
  return { correct, ran: true, reason: correct ? 'ANSWER_KEY_CORRECT' : 'ANSWER_KEY_WRONG' };
}
