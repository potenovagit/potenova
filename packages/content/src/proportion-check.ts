import type { MathCheckReason } from './math-check';

/**
 * Deterministic proportion-solving oracle (Ontario Grade 7 B2 / exp B2.10:
 * apply proportional reasoning to solve problems). Solves the missing term of a
 * proportion a/b = c/x for x, by exact integer arithmetic: cross-multiplying,
 * a·x = b·c, so x = b·c / a. Graded by value. No model.
 *
 * Fail-closed on range AND on non-whole solutions: a, b, c are whole numbers in
 * [1, 100], and b·c MUST be divisible by a so x is a whole number (the
 * rule-decidable slice stays in clean integer answers — a proportion whose
 * missing term is not a whole number is MALFORMED and never reaches a child).
 * The claimed value must be a positive integer. Anything else is MALFORMED.
 */

const inRange = (n: number): boolean => Number.isInteger(n) && n >= 1 && n <= 100;

export interface ProportionSolveTask {
  readonly kind: 'proportion_solve';
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly claimedX: number;
}

export interface ProportionCheckResult {
  readonly correct: boolean;
  readonly ran: boolean;
  readonly reason: MathCheckReason;
}

/** The missing term x of a/b = c/x, or null if out of range or not a whole number. */
export function proportionSolve(a: number, b: number, c: number): number | null {
  if (!inRange(a) || !inRange(b) || !inRange(c)) return null;
  const product = b * c;
  return product % a === 0 ? product / a : null;
}

export function checkProportionSolveTask(task: ProportionSolveTask): ProportionCheckResult {
  if (task.kind !== 'proportion_solve') {
    return { correct: false, ran: false, reason: 'UNSUPPORTED_TASK' };
  }
  if (!Number.isInteger(task.claimedX) || task.claimedX < 1) {
    return { correct: false, ran: false, reason: 'MALFORMED_TASK' };
  }
  const x = proportionSolve(task.a, task.b, task.c);
  if (x === null) return { correct: false, ran: false, reason: 'MALFORMED_TASK' };
  const correct = task.claimedX === x;
  return { correct, ran: true, reason: correct ? 'ANSWER_KEY_CORRECT' : 'ANSWER_KEY_WRONG' };
}
