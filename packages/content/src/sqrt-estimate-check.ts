import type { MathCheckReason } from './math-check';
import { isPerfectSquare } from './perfect-square-check';

/**
 * Deterministic square-root estimation oracle (Ontario Grade 8 B1 / exp B1.3:
 * estimate and calculate square roots). For a NON-perfect-square n, the learner
 * names the two consecutive whole numbers its square root lies between by giving
 * the smaller one, k, where k² < n < (k+1)². Exact integer arithmetic (an
 * integer floor-sqrt, no floats). No model.
 *
 * A DISTINCT kind from the Grade 7 `perfect_square_root` oracle (which gives the
 * EXACT root of a perfect square): this one is defined ONLY for non-perfect
 * squares. Fail-closed on range AND on perfect squares: n is a whole number in
 * [2, 10000] and MUST NOT be a perfect square (a perfect square has an exact
 * root, not a strict between — that is the Grade 7 skill). The claimed lower
 * bound must be a non-negative integer. Anything else is MALFORMED.
 */

const inRange = (n: number): boolean => Number.isInteger(n) && n >= 2 && n <= 10000;

/** Largest integer k with k·k ≤ n, by exact integer search (no floats). */
export function floorSqrt(n: number): number {
  let k = 0;
  while ((k + 1) * (k + 1) <= n) k++;
  return k;
}

export interface SqrtBetweenTask {
  readonly kind: 'sqrt_between';
  readonly value: number;
  readonly claimedLower: number;
}

export interface SqrtEstimateCheckResult {
  readonly correct: boolean;
  readonly ran: boolean;
  readonly reason: MathCheckReason;
}

export function checkSqrtBetweenTask(task: SqrtBetweenTask): SqrtEstimateCheckResult {
  if (task.kind !== 'sqrt_between') {
    return { correct: false, ran: false, reason: 'UNSUPPORTED_TASK' };
  }
  // fail closed: in range, NOT a perfect square, and an integer claim
  if (
    !inRange(task.value) ||
    isPerfectSquare(task.value) ||
    !Number.isInteger(task.claimedLower) ||
    task.claimedLower < 0
  ) {
    return { correct: false, ran: false, reason: 'MALFORMED_TASK' };
  }
  const k = floorSqrt(task.value); // k² < n < (k+1)² since n is not a perfect square
  const correct = task.claimedLower === k;
  return { correct, ran: true, reason: correct ? 'ANSWER_KEY_CORRECT' : 'ANSWER_KEY_WRONG' };
}
