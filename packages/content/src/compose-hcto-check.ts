import type { MathCheckReason } from './math-check';

/**
 * Deterministic place-value composition oracle for hundreds-tens-ones (Ontario
 * Grade 2 B1.2, the rule-decidable slice: compose/decompose whole numbers to
 * 200). The learner is given a count of hundreds, tens and ones and names the
 * whole number — e.g. "1 hundred, 4 tens and 6 ones" = 146. Closed and
 * rule-decidable; the value is computed exactly and a learner answer is graded
 * without a model.
 *
 * This is a DISTINCT task kind from the Grade 1 `place_value_compose` oracle
 * (tens + ones, ≤50), which is left byte-identical — the G2 hundreds place rides
 * its own kind rather than widening the G1 contract.
 *
 * Fail-closed on range: hundreds, tens and ones are non-negative whole numbers,
 * the tens and ones digits each stay in [0, 9], and the composed value stays
 * within [0, 200] (the Grade 2 bound) — anything else is MALFORMED. The
 * representation side of B1.2 (base-ten materials, etc.) is the educator's to
 * author; this oracle covers only the numeric composition.
 */

export interface ComposeHctoTask {
  readonly kind: 'compose_hcto';
  readonly hundreds: number;
  readonly tens: number;
  readonly ones: number;
  /** The claimed composed value (an answer key, or a learner's answer). */
  readonly claimedValue: number;
}

export interface ComposeHctoCheckResult {
  readonly correct: boolean;
  readonly ran: boolean;
  readonly reason: MathCheckReason;
}

const isNonNegInt = (n: number): boolean => Number.isInteger(n) && n >= 0;

/** The whole number composed from `hundreds` hundreds, `tens` tens and `ones` ones. */
export function composeHctoValue(hundreds: number, tens: number, ones: number): number {
  return hundreds * 100 + tens * 10 + ones;
}

export function checkComposeHctoTask(task: ComposeHctoTask): ComposeHctoCheckResult {
  if (task.kind !== 'compose_hcto') {
    return { correct: false, ran: false, reason: 'UNSUPPORTED_TASK' };
  }
  const value = composeHctoValue(task.hundreds, task.tens, task.ones);
  if (
    !isNonNegInt(task.hundreds) ||
    !isNonNegInt(task.tens) ||
    !isNonNegInt(task.ones) ||
    task.tens > 9 ||
    task.ones > 9 ||
    value > 200 ||
    !Number.isInteger(task.claimedValue)
  ) {
    return { correct: false, ran: false, reason: 'MALFORMED_TASK' };
  }
  const correct = value === task.claimedValue;
  return { correct, ran: true, reason: correct ? 'ANSWER_KEY_CORRECT' : 'ANSWER_KEY_WRONG' };
}
