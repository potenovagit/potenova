import type { MathCheckReason } from './math-check';

/**
 * Deterministic even/odd oracle (Ontario Grade 2 B1.5: describe what makes a
 * number even or odd). The learner says whether a whole number is even or odd;
 * the oracle decides by the number itself, with no model.
 *
 * Fail-closed: the number is a non-negative whole number and the claim is
 * exactly 'even' or 'odd'; anything else is MALFORMED.
 */

export type Parity = 'even' | 'odd';

export interface ParityTask {
  readonly kind: 'number_parity';
  readonly n: number;
  readonly claimed: Parity;
}

export interface ParityCheckResult {
  readonly correct: boolean;
  readonly ran: boolean;
  readonly reason: MathCheckReason;
}

const isNonNegInt = (n: number): boolean => Number.isInteger(n) && n >= 0;

/** The parity of a whole number. */
export function parityOf(n: number): Parity {
  return n % 2 === 0 ? 'even' : 'odd';
}

export function checkParityTask(task: ParityTask): ParityCheckResult {
  if (task.kind !== 'number_parity') {
    return { correct: false, ran: false, reason: 'UNSUPPORTED_TASK' };
  }
  if (!isNonNegInt(task.n) || (task.claimed !== 'even' && task.claimed !== 'odd')) {
    return { correct: false, ran: false, reason: 'MALFORMED_TASK' };
  }
  const correct = parityOf(task.n) === task.claimed;
  return { correct, ran: true, reason: correct ? 'ANSWER_KEY_CORRECT' : 'ANSWER_KEY_WRONG' };
}
