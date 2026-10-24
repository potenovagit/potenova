import type { MathCheckReason } from './math-check';

/**
 * Deterministic signed-integer comparison oracle (Ontario Grade 6 B1 / exp 1, 2:
 * read, compare and order integers, including negatives, on a number line).
 * Closed and rule-decidable: the comparison is exact integer arithmetic, graded
 * without a model.
 *
 * This is a DISTINCT task kind from the whole-number `integer_comparison` oracle,
 * which is non-negative only — negatives are new at Grade 6, so they ride their
 * own kind rather than relaxing the whole-number contract.
 *
 * Fail-closed on range: both values are integers with magnitude ≤ 1000 (so
 * −1000..1000). Anything else is MALFORMED.
 */

export type SignedRelation = 'lt' | 'eq' | 'gt';

const inRange = (n: number): boolean => Number.isInteger(n) && n >= -1000 && n <= 1000;

export interface SignedIntegerCompareTask {
  readonly kind: 'integer_signed_compare';
  readonly left: number;
  readonly right: number;
  readonly claimedRelation: SignedRelation;
}

export interface SignedIntegerCheckResult {
  readonly correct: boolean;
  readonly ran: boolean;
  readonly reason: MathCheckReason;
}

export function signedRelation(left: number, right: number): SignedRelation {
  if (left < right) return 'lt';
  if (left > right) return 'gt';
  return 'eq';
}

export function checkSignedIntegerCompareTask(
  task: SignedIntegerCompareTask,
): SignedIntegerCheckResult {
  if (task.kind !== 'integer_signed_compare') {
    return { correct: false, ran: false, reason: 'UNSUPPORTED_TASK' };
  }
  if (
    !inRange(task.left) ||
    !inRange(task.right) ||
    (task.claimedRelation !== 'lt' &&
      task.claimedRelation !== 'eq' &&
      task.claimedRelation !== 'gt')
  ) {
    return { correct: false, ran: false, reason: 'MALFORMED_TASK' };
  }
  const correct = signedRelation(task.left, task.right) === task.claimedRelation;
  return { correct, ran: true, reason: correct ? 'ANSWER_KEY_CORRECT' : 'ANSWER_KEY_WRONG' };
}
