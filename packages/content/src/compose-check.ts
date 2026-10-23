import type { MathCheckReason } from './math-check';

/**
 * Deterministic place-value composition oracle (Ontario Grade 1 B1.2, the
 * rule-decidable slice: compose/decompose whole numbers to 50). The learner is
 * given a count of tens and ones and names the whole number — e.g. "3 tens and
 * 5 ones" = 35. Closed and rule-decidable; the value is computed exactly and a
 * learner answer is graded without a model.
 *
 * Fail-closed on range: tens and ones are non-negative whole numbers, the ones
 * digit stays in [0, 9], and the composed value stays within [0, 50] (the Grade
 * 1 bound) — anything else is MALFORMED. The representation side of B1.2
 * (base-ten materials, etc.) is the educator's to author; this oracle covers
 * only the numeric composition.
 */

export interface PlaceValueComposeTask {
  readonly kind: 'place_value_compose';
  readonly tens: number;
  readonly ones: number;
  /** The claimed composed value (an answer key, or a learner's answer). */
  readonly claimedValue: number;
}

export interface ComposeCheckResult {
  readonly correct: boolean;
  readonly ran: boolean;
  readonly reason: MathCheckReason;
}

const isNonNegInt = (n: number): boolean => Number.isInteger(n) && n >= 0;

/** The whole number composed from `tens` tens and `ones` ones. */
export function composeValue(tens: number, ones: number): number {
  return tens * 10 + ones;
}

export function checkComposeTask(task: PlaceValueComposeTask): ComposeCheckResult {
  if (task.kind !== 'place_value_compose') {
    return { correct: false, ran: false, reason: 'UNSUPPORTED_TASK' };
  }
  const value = composeValue(task.tens, task.ones);
  if (
    !isNonNegInt(task.tens) ||
    !isNonNegInt(task.ones) ||
    task.ones > 9 ||
    value > 50 ||
    !Number.isInteger(task.claimedValue)
  ) {
    return { correct: false, ran: false, reason: 'MALFORMED_TASK' };
  }
  const correct = value === task.claimedValue;
  return { correct, ran: true, reason: correct ? 'ANSWER_KEY_CORRECT' : 'ANSWER_KEY_WRONG' };
}
