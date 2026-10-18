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

/** SK-FR-partition: a whole split into `parts` equal parts, `shaded` of them shaded;
 *  the named fraction should equal shaded/parts. */
export interface FractionPartitionTask {
  readonly kind: 'fraction_partition';
  readonly parts: number;
  readonly shaded: number;
  readonly claimedFraction: Fraction;
}

/** SK-FR-unit: the unit fraction for a whole split into `denominator` equal parts is 1/denominator. */
export interface UnitFractionTask {
  readonly kind: 'fraction_unit';
  readonly denominator: number;
  readonly claimedUnit: Fraction;
}

/** SK-FR-nonunit: `count` copies of the unit fraction 1/`unitDenominator` make count/unitDenominator. */
export interface NonUnitBuildTask {
  readonly kind: 'fraction_nonunit_build';
  readonly count: number;
  readonly unitDenominator: number;
  readonly claimedFraction: Fraction;
}

/** SK-FR-numberline: place `fraction` on a 0..1 line of `intervals` equal steps; the tick
 *  index is an integer iff the fraction lands on a tick. */
export interface NumberLineTask {
  readonly kind: 'fraction_number_line';
  readonly fraction: Fraction;
  readonly intervals: number;
  readonly claimedTick: number;
}

/** SK-FR-order: `claimedOrder` is a permutation of the fraction indices claimed to be ascending. */
export interface FractionOrderTask {
  readonly kind: 'fraction_order';
  readonly fractions: readonly Fraction[];
  readonly claimedOrder: readonly number[];
}

export type MathTask =
  | FractionComparisonTask
  | FractionEquivalenceTask
  | FractionPartitionTask
  | UnitFractionTask
  | NonUnitBuildTask
  | NumberLineTask
  | FractionOrderTask;

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
    case 'fraction_partition': {
      const okShape =
        Number.isInteger(task.parts) &&
        task.parts > 0 &&
        Number.isInteger(task.shaded) &&
        task.shaded >= 0 &&
        task.shaded <= task.parts &&
        isWellFormed(task.claimedFraction);
      if (!okShape) return { correct: false, ran: false, reason: 'MALFORMED_TASK' };
      // one part of a parts-partition = 1/parts; shaded of them = shaded/parts
      const correct = areEquivalent(task.claimedFraction, {
        numerator: task.shaded,
        denominator: task.parts,
      });
      return { correct, ran: true, reason: correct ? 'ANSWER_KEY_CORRECT' : 'ANSWER_KEY_WRONG' };
    }
    case 'fraction_unit': {
      const okShape =
        Number.isInteger(task.denominator) &&
        task.denominator > 0 &&
        isWellFormed(task.claimedUnit);
      if (!okShape) return { correct: false, ran: false, reason: 'MALFORMED_TASK' };
      // the unit fraction is exactly 1/denominator (naming, not an equivalent form)
      const correct =
        task.claimedUnit.numerator === 1 && task.claimedUnit.denominator === task.denominator;
      return { correct, ran: true, reason: correct ? 'ANSWER_KEY_CORRECT' : 'ANSWER_KEY_WRONG' };
    }
    case 'fraction_nonunit_build': {
      const okShape =
        Number.isInteger(task.count) &&
        task.count >= 0 &&
        Number.isInteger(task.unitDenominator) &&
        task.unitDenominator > 0 &&
        isWellFormed(task.claimedFraction);
      if (!okShape) return { correct: false, ran: false, reason: 'MALFORMED_TASK' };
      const correct = areEquivalent(task.claimedFraction, {
        numerator: task.count,
        denominator: task.unitDenominator,
      });
      return { correct, ran: true, reason: correct ? 'ANSWER_KEY_CORRECT' : 'ANSWER_KEY_WRONG' };
    }
    case 'fraction_number_line': {
      const okShape =
        isWellFormed(task.fraction) &&
        Number.isInteger(task.intervals) &&
        task.intervals > 0 &&
        Number.isInteger(task.claimedTick) &&
        task.fraction.numerator <= task.fraction.denominator; // on [0,1]
      if (!okShape) return { correct: false, ran: false, reason: 'MALFORMED_TASK' };
      // the fraction lands on tick t iff t/intervals == p/q, i.e. t*q == p*intervals (exact)
      const lands = task.fraction.numerator * task.intervals;
      if (lands % task.fraction.denominator !== 0) {
        // not representable on this line — a malformed item, never "correct"
        return { correct: false, ran: false, reason: 'MALFORMED_TASK' };
      }
      const correct = task.claimedTick * task.fraction.denominator === lands;
      return { correct, ran: true, reason: correct ? 'ANSWER_KEY_CORRECT' : 'ANSWER_KEY_WRONG' };
    }
    case 'fraction_order': {
      const n = task.fractions.length;
      const okShape =
        n >= 2 &&
        task.fractions.every(isWellFormed) &&
        task.claimedOrder.length === n &&
        new Set(task.claimedOrder).size === n &&
        task.claimedOrder.every((i) => Number.isInteger(i) && i >= 0 && i < n);
      if (!okShape) return { correct: false, ran: false, reason: 'MALFORMED_TASK' };
      // claimed order is correct iff consecutive pairs are non-decreasing (exact, no floats)
      let correct = true;
      for (let i = 0; i + 1 < n; i++) {
        const a = task.fractions[task.claimedOrder[i]!]!;
        const b = task.fractions[task.claimedOrder[i + 1]!]!;
        if (trueRelation(a, b) === 'gt') {
          correct = false;
          break;
        }
      }
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
