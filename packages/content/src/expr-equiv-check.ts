import type { MathCheckReason } from './math-check';

/**
 * Deterministic expression-equivalence oracle (Ontario Grade 1 C2.2: determine
 * whether two addition/subtraction expressions are equal in value, e.g. is
 * 3 + 4 the same as 9 - 2?). Closed and rule-decidable: each side is a simple
 * two-operand whole-number expression, both are evaluated exactly, and the
 * learner's yes/no is graded without a model.
 *
 * Fail-closed on range: only '+' and '-' are allowed and every operand and
 * BOTH side-values must be non-negative whole numbers (a side that would go
 * negative, e.g. 2 - 5, makes the item MALFORMED — Grade 1 stays within whole
 * numbers).
 */

export type ExprOp = '+' | '-';

export interface Expr {
  readonly a: number;
  readonly op: ExprOp;
  readonly b: number;
}

export interface ExprEquivalenceTask {
  readonly kind: 'expr_equivalence';
  readonly left: Expr;
  readonly right: Expr;
  /** The claimed verdict: are the two sides equal in value? */
  readonly claimedEquivalent: boolean;
}

export interface ExprEquivCheckResult {
  readonly correct: boolean;
  readonly ran: boolean;
  readonly reason: MathCheckReason;
}

const isNonNegInt = (n: number): boolean => Number.isInteger(n) && n >= 0;

/** Evaluate a simple whole-number expression, or null if it is out of range
 *  (bad operator, non-integer/negative operand, or a negative result). */
export function evalExpr(e: Expr): number | null {
  if (!isNonNegInt(e.a) || !isNonNegInt(e.b)) return null;
  if (e.op !== '+' && e.op !== '-') return null;
  const v = e.op === '+' ? e.a + e.b : e.a - e.b;
  return v >= 0 ? v : null;
}

export function checkExprEquivalenceTask(task: ExprEquivalenceTask): ExprEquivCheckResult {
  if (task.kind !== 'expr_equivalence') {
    return { correct: false, ran: false, reason: 'UNSUPPORTED_TASK' };
  }
  const lv = evalExpr(task.left);
  const rv = evalExpr(task.right);
  if (lv === null || rv === null || typeof task.claimedEquivalent !== 'boolean') {
    return { correct: false, ran: false, reason: 'MALFORMED_TASK' };
  }
  const correct = (lv === rv) === task.claimedEquivalent;
  return { correct, ran: true, reason: correct ? 'ANSWER_KEY_CORRECT' : 'ANSWER_KEY_WRONG' };
}
