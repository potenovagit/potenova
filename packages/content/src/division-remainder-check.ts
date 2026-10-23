import type { MathCheckReason } from './math-check';

/**
 * Deterministic division-with-remainder oracle (Ontario Grade 4 B2 / exp 14:
 * divide a two- or three-digit whole number by a one-digit number, expressing
 * the remainder). The learner gives BOTH the whole-number quotient and the
 * remainder. Closed and rule-decidable: quotient and remainder are computed
 * exactly (q = ⌊dividend / divisor⌋, r = dividend mod divisor) and graded
 * without a model.
 *
 * This is a DISTINCT task kind from the Grade 3 `integer_division` fact oracle,
 * which requires EXACT division (fail-closed on any remainder). G4 division
 * produces a remainder, so it rides its own kind rather than relaxing the G3
 * exact-division contract.
 *
 * Fail-closed on range: the dividend is a non-negative whole number no greater
 * than 999, the divisor is a one-digit number (1–9), and the claimed quotient
 * and remainder are integers. Anything else is MALFORMED.
 */

export interface DivisionRemainderTask {
  readonly kind: 'division_with_remainder';
  readonly dividend: number;
  readonly divisor: number;
  readonly claimedQuotient: number;
  readonly claimedRemainder: number;
}

export interface DivisionRemainderCheckResult {
  readonly correct: boolean;
  readonly ran: boolean;
  readonly reason: MathCheckReason;
}

const isNonNegInt = (n: number): boolean => Number.isInteger(n) && n >= 0;

export function checkDivisionRemainderTask(
  task: DivisionRemainderTask,
): DivisionRemainderCheckResult {
  if (task.kind !== 'division_with_remainder') {
    return { correct: false, ran: false, reason: 'UNSUPPORTED_TASK' };
  }
  const wellPosed =
    isNonNegInt(task.dividend) &&
    task.dividend <= 999 &&
    Number.isInteger(task.divisor) &&
    task.divisor >= 1 &&
    task.divisor <= 9 &&
    Number.isInteger(task.claimedQuotient) &&
    Number.isInteger(task.claimedRemainder);
  if (!wellPosed) return { correct: false, ran: false, reason: 'MALFORMED_TASK' };
  const quotient = Math.floor(task.dividend / task.divisor);
  const remainder = task.dividend % task.divisor;
  const correct = task.claimedQuotient === quotient && task.claimedRemainder === remainder;
  return { correct, ran: true, reason: correct ? 'ANSWER_KEY_CORRECT' : 'ANSWER_KEY_WRONG' };
}
