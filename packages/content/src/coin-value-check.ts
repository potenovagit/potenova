import type { MathCheckReason } from './math-check';

/**
 * Deterministic coin/bill-value oracle (Ontario Grade 1 F1.1, the rule-decidable
 * slice: identify Canadian coins and bills to $50 and total their value). The
 * learner is shown a set of Canadian money pieces and gives the total value in
 * cents. Closed and rule-decidable; the total is summed exactly and a learner
 * answer is graded without a model.
 *
 * Denominations are the real post-penny Canadian set, in cents: 5 (nickel),
 * 10 (dime), 25 (quarter), 100 ($1 loonie), 200 ($2 toonie), 500 ($5),
 * 1000 ($10), 2000 ($20), 5000 ($50). Fail-closed: any piece that is not one of
 * these, an empty set, or a total over the item's bound makes the item MALFORMED.
 *
 * The bound is the item's own `maxTotalCents`, defaulting to $50 (5000¢) — the
 * Grade 1 F1.1 slice. A Grade 2 money-to-$100 item sets it to 10000¢. The bound
 * never relaxes the denomination set, so a G1 item can never reach a G2 total.
 */

export const CANADIAN_DENOMINATIONS_CENTS = [5, 10, 25, 100, 200, 500, 1000, 2000, 5000] as const;
const ALLOWED = new Set<number>(CANADIAN_DENOMINATIONS_CENTS);

export interface CoinValueTask {
  readonly kind: 'coin_value';
  /** The pieces shown, each a denomination in cents. */
  readonly pieces: readonly number[];
  /** The claimed total in cents (an answer key, or a learner's answer). */
  readonly claimedTotalCents: number;
  /** The highest total this item may sum to, in cents. Defaults to 5000 ($50). */
  readonly maxTotalCents?: number;
}

export interface CoinValueCheckResult {
  readonly correct: boolean;
  readonly ran: boolean;
  readonly reason: MathCheckReason;
}

/** The exact total of a set of pieces, in cents. */
export function coinTotalCents(pieces: readonly number[]): number {
  return pieces.reduce((sum, p) => sum + p, 0);
}

export function checkCoinValueTask(task: CoinValueTask): CoinValueCheckResult {
  if (task.kind !== 'coin_value') {
    return { correct: false, ran: false, reason: 'UNSUPPORTED_TASK' };
  }
  const total = coinTotalCents(task.pieces);
  const maxTotalCents = task.maxTotalCents ?? 5000;
  if (
    task.pieces.length === 0 ||
    !task.pieces.every((p) => ALLOWED.has(p)) ||
    total > maxTotalCents ||
    !Number.isInteger(task.claimedTotalCents)
  ) {
    return { correct: false, ran: false, reason: 'MALFORMED_TASK' };
  }
  const correct = total === task.claimedTotalCents;
  return { correct, ran: true, reason: correct ? 'ANSWER_KEY_CORRECT' : 'ANSWER_KEY_WRONG' };
}
