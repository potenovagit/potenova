/**
 * Deterministic Math correctness checks (ADR-0006; CONT-001/003; NFR-07; AT-20).
 *
 * The answer key of a generated Math task is verified by EXACT integer arithmetic —
 * never by another language model, and never by floating point. This is the
 * independent, reproducible oracle that lets validation block a task whose key is
 * wrong (AT-20) regardless of how confident the generator was.
 *
 * Scope here: the DRAFT fractions strand (equivalence / comparison), matching the
 * WP-02 curriculum fixture. Other task families are reported UNSUPPORTED so they
 * fall through to the (fail-closed) validation path rather than being silently
 * treated as correct.
 */

export type FractionRelation = 'lt' | 'eq' | 'gt';

export interface Fraction {
  readonly numerator: number;
  readonly denominator: number;
}

export function isWellFormed(f: Fraction): boolean {
  return (
    Number.isInteger(f.numerator) &&
    Number.isInteger(f.denominator) &&
    f.denominator > 0 &&
    f.numerator >= 0
  );
}

/** Ground-truth relation of a vs b by cross-multiplication — exact, no floats. */
export function trueRelation(a: Fraction, b: Fraction): FractionRelation {
  const left = a.numerator * b.denominator;
  const right = b.numerator * a.denominator;
  if (left < right) return 'lt';
  if (left > right) return 'gt';
  return 'eq';
}

export function areEquivalent(a: Fraction, b: Fraction): boolean {
  return a.numerator * b.denominator === b.numerator * a.denominator;
}

export interface FractionComparisonTask {
  readonly kind: 'fraction_comparison';
  readonly left: Fraction;
  readonly right: Fraction;
  /** The generator's claimed answer key. */
  readonly claimedAnswer: FractionRelation;
}

export interface FractionEquivalenceTask {
  readonly kind: 'fraction_equivalence';
  readonly left: Fraction;
  readonly right: Fraction;
  readonly claimedEquivalent: boolean;
}

export type MathTask = FractionComparisonTask | FractionEquivalenceTask;

export type MathCheckReason =
  | 'ANSWER_KEY_CORRECT'
  | 'ANSWER_KEY_WRONG'
  | 'MALFORMED_TASK'
  | 'UNSUPPORTED_TASK';

export interface MathCheckResult {
  /** True only when the task is supported, well-formed AND the key is correct. */
  readonly correct: boolean;
  /** True when this checker has an opinion at all (supported + well-formed). */
  readonly ran: boolean;
  readonly reason: MathCheckReason;
}

/**
 * Verify a generated Math task's answer key. Reason codes only — never any child
 * content — so the result is safe to log and trace (contracts error-leak rule).
 */
export function checkMathTask(task: MathTask): MathCheckResult {
  switch (task.kind) {
    case 'fraction_comparison': {
      if (!isWellFormed(task.left) || !isWellFormed(task.right)) {
        return { correct: false, ran: false, reason: 'MALFORMED_TASK' };
      }
      const truth = trueRelation(task.left, task.right);
      const correct = truth === task.claimedAnswer;
      return { correct, ran: true, reason: correct ? 'ANSWER_KEY_CORRECT' : 'ANSWER_KEY_WRONG' };
    }
    case 'fraction_equivalence': {
      if (!isWellFormed(task.left) || !isWellFormed(task.right)) {
        return { correct: false, ran: false, reason: 'MALFORMED_TASK' };
      }
      const correct = areEquivalent(task.left, task.right) === task.claimedEquivalent;
      return { correct, ran: true, reason: correct ? 'ANSWER_KEY_CORRECT' : 'ANSWER_KEY_WRONG' };
    }
    default: {
      // Exhaustiveness guard: an unknown family never counts as "checked correct".
      const _never: never = task;
      void _never;
      return { correct: false, ran: false, reason: 'UNSUPPORTED_TASK' };
    }
  }
}
