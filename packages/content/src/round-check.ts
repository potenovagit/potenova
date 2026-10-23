import type { MathCheckReason } from './math-check';

/**
 * Deterministic whole-number rounding oracle (Ontario Grade 4 B1 / exp 2: round
 * whole numbers to the nearest ten, hundred, or thousand). Closed and
 * rule-decidable: the rounded value is computed exactly (round-half-up) and
 * graded without a model.
 *
 * Fail-closed on range: the value is a non-negative whole number no greater than
 * 100000, the place is exactly 10, 100 or 1000, and the claimed result is an
 * integer. Anything else is MALFORMED.
 */

export type RoundPlace = 10 | 100 | 1000;

export interface RoundWholeTask {
  readonly kind: 'round_whole';
  readonly value: number;
  readonly place: RoundPlace;
  /** The claimed rounded value (an answer key, or a learner's answer). */
  readonly claimedRounded: number;
}

export interface RoundCheckResult {
  readonly correct: boolean;
  readonly ran: boolean;
  readonly reason: MathCheckReason;
}

const isNonNegInt = (n: number): boolean => Number.isInteger(n) && n >= 0;

/** Round a whole number to the nearest `place` (10/100/1000), half rounding up. */
export function roundToPlace(value: number, place: RoundPlace): number {
  return Math.floor((value + place / 2) / place) * place;
}

export function checkRoundWholeTask(task: RoundWholeTask): RoundCheckResult {
  if (task.kind !== 'round_whole') {
    return { correct: false, ran: false, reason: 'UNSUPPORTED_TASK' };
  }
  const placeOk = task.place === 10 || task.place === 100 || task.place === 1000;
  if (
    !isNonNegInt(task.value) ||
    task.value > 100000 ||
    !placeOk ||
    !Number.isInteger(task.claimedRounded)
  ) {
    return { correct: false, ran: false, reason: 'MALFORMED_TASK' };
  }
  const correct = roundToPlace(task.value, task.place) === task.claimedRounded;
  return { correct, ran: true, reason: correct ? 'ANSWER_KEY_CORRECT' : 'ANSWER_KEY_WRONG' };
}
