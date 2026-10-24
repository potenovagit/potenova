import type { MathCheckReason } from './math-check';

/**
 * Deterministic perfect-square / square-root oracle (Ontario Grade 7 B1 /
 * exp B1.2: identify and represent perfect squares and determine their square
 * roots). Two rule-decidable kinds, both exact-integer and model-free:
 *
 *   perfect_square_root  — given a perfect square n, the learner gives its
 *                          non-negative integer root r (r·r = n). The task is
 *                          FAIL-CLOSED on a non-perfect-square n, so a child is
 *                          never asked for the root of a number that has none.
 *   is_perfect_square    — given any n in range, the learner judges whether n is
 *                          a perfect square (yes/no), graded against the exact
 *                          integer test.
 *
 * Range: n is a non-negative whole number no greater than 10000 (roots 0..100),
 * so the grade-7 slice stays in clean two-digit roots. Anything else, or a
 * negative/non-integer claim, is MALFORMED.
 */

const isNonNegInt = (n: number): boolean => Number.isInteger(n) && n >= 0;

/** The exact non-negative integer square root of n, or null if n is not a perfect square (or out of range). */
export function exactSqrt(n: number): number | null {
  if (!isNonNegInt(n) || n > 10000) return null;
  const r = Math.round(Math.sqrt(n));
  // check both r and neighbours to avoid any floating rounding at the boundary
  for (const c of [r - 1, r, r + 1]) {
    if (c >= 0 && c * c === n) return c;
  }
  return null;
}

export function isPerfectSquare(n: number): boolean {
  return exactSqrt(n) !== null;
}

export interface PerfectSquareRootTask {
  readonly kind: 'perfect_square_root';
  readonly square: number;
  readonly claimedRoot: number;
}

export interface IsPerfectSquareTask {
  readonly kind: 'is_perfect_square';
  readonly value: number;
  readonly claimedIsSquare: boolean;
}

export interface PerfectSquareCheckResult {
  readonly correct: boolean;
  readonly ran: boolean;
  readonly reason: MathCheckReason;
}

export function checkPerfectSquareRootTask(task: PerfectSquareRootTask): PerfectSquareCheckResult {
  if (task.kind !== 'perfect_square_root') {
    return { correct: false, ran: false, reason: 'UNSUPPORTED_TASK' };
  }
  const root = exactSqrt(task.square);
  // Fail closed: the task itself must present a perfect square, and the claim an integer.
  if (root === null || !isNonNegInt(task.claimedRoot)) {
    return { correct: false, ran: false, reason: 'MALFORMED_TASK' };
  }
  const correct = task.claimedRoot === root;
  return { correct, ran: true, reason: correct ? 'ANSWER_KEY_CORRECT' : 'ANSWER_KEY_WRONG' };
}

export function checkIsPerfectSquareTask(task: IsPerfectSquareTask): PerfectSquareCheckResult {
  if (task.kind !== 'is_perfect_square') {
    return { correct: false, ran: false, reason: 'UNSUPPORTED_TASK' };
  }
  if (!isNonNegInt(task.value) || task.value > 10000 || typeof task.claimedIsSquare !== 'boolean') {
    return { correct: false, ran: false, reason: 'MALFORMED_TASK' };
  }
  const correct = isPerfectSquare(task.value) === task.claimedIsSquare;
  return { correct, ran: true, reason: correct ? 'ANSWER_KEY_CORRECT' : 'ANSWER_KEY_WRONG' };
}
