import type { MathCheckReason } from './math-check';

/**
 * Deterministic whole-number compare/order oracle — the number-sense counterpart
 * to the fraction compare/order oracle (Ontario Grade 1 B1.3: compare and order
 * whole numbers to 50). Closed and rule-decidable: the relation / ordering is
 * computed exactly and verified independently before delivery, and a learner
 * answer is graded without a model.
 */

export type WholeRelation = 'lt' | 'eq' | 'gt';

/** The exact relation of two whole numbers (first vs second). */
export function wholeRelation(a: number, b: number): WholeRelation {
  return a < b ? 'lt' : a > b ? 'gt' : 'eq';
}

export interface IntegerComparisonTask {
  readonly kind: 'integer_comparison';
  readonly a: number;
  readonly b: number;
  /** The claimed relation of a to b (an answer key, or a learner's answer). */
  readonly claimedRelation: WholeRelation;
}

export interface IntegerOrderingTask {
  readonly kind: 'integer_ordering';
  readonly numbers: readonly number[];
  /** Claimed ascending order as 0-based indices into `numbers`. */
  readonly claimedOrder: readonly number[];
}

export type WholeNumberTask = IntegerComparisonTask | IntegerOrderingTask;

export interface WholeNumberCheckResult {
  readonly correct: boolean;
  readonly ran: boolean;
  readonly reason: MathCheckReason;
}

const isNonNegInt = (n: number): boolean => Number.isInteger(n) && n >= 0;
const isRelation = (v: unknown): v is WholeRelation => v === 'lt' || v === 'eq' || v === 'gt';

export function checkWholeNumberTask(task: WholeNumberTask): WholeNumberCheckResult {
  switch (task.kind) {
    case 'integer_comparison': {
      if (!isNonNegInt(task.a) || !isNonNegInt(task.b) || !isRelation(task.claimedRelation)) {
        return { correct: false, ran: false, reason: 'MALFORMED_TASK' };
      }
      const correct = wholeRelation(task.a, task.b) === task.claimedRelation;
      return { correct, ran: true, reason: correct ? 'ANSWER_KEY_CORRECT' : 'ANSWER_KEY_WRONG' };
    }
    case 'integer_ordering': {
      const n = task.numbers.length;
      const okShape =
        n >= 2 &&
        task.numbers.every(isNonNegInt) &&
        task.claimedOrder.length === n &&
        new Set(task.claimedOrder).size === n &&
        task.claimedOrder.every((i) => Number.isInteger(i) && i >= 0 && i < n);
      if (!okShape) return { correct: false, ran: false, reason: 'MALFORMED_TASK' };
      // Correct iff consecutive picks are non-decreasing (ties allowed).
      let correct = true;
      for (let i = 0; i + 1 < n; i++) {
        if (task.numbers[task.claimedOrder[i]!]! > task.numbers[task.claimedOrder[i + 1]!]!) {
          correct = false;
          break;
        }
      }
      return { correct, ran: true, reason: correct ? 'ANSWER_KEY_CORRECT' : 'ANSWER_KEY_WRONG' };
    }
    default: {
      const _never: never = task;
      void _never;
      return { correct: false, ran: false, reason: 'UNSUPPORTED_TASK' };
    }
  }
}
