import type { ValidationVerdict } from '@potenova/domain-core';
import { trueRelation, areEquivalent, type Fraction } from './math-check';
import {
  evaluateMathCandidate,
  evaluateEquivalenceCandidate,
  type DeliveryOutcomeKind,
  type GeneratedMathAnswer,
  type GeneratedEquivalenceAnswer,
} from './model-eval';

/**
 * Candidate-model evaluation harness on SYNTHETIC data (AI-003; ADR-0005/0006;
 * the ER-16 quality/safety evaluation + NFR-07/NFR-08 that fix the model before G2).
 *
 * Runs a fixed synthetic suite spanning two fraction skills — comparison and
 * equivalence — through the same generator→independent-oracle→content-gate path,
 * and aggregates an evidence-ready report: accuracy overall and per skill, and —
 * the property that actually gates — containment: every WRONG answer must be kept
 * from delivery (FALLBACK/BLOCK), never delivered. Nothing reaches a child.
 */

export type SuiteSkill = 'comparison' | 'equivalence';

export type SuiteTask =
  | { readonly kind: 'comparison'; readonly left: Fraction; readonly right: Fraction }
  | { readonly kind: 'equivalence'; readonly left: Fraction; readonly right: Fraction };

export type SuiteAnswer =
  | ({ readonly kind: 'comparison' } & GeneratedMathAnswer)
  | ({ readonly kind: 'equivalence' } & GeneratedEquivalenceAnswer);

/** Produce a candidate's answer for a task (async: the real provider is a network call). */
export type SuiteGenerate = (task: SuiteTask) => Promise<SuiteAnswer>;

export interface EvalSuiteItem {
  readonly kind: SuiteSkill;
  /** Human-readable task label, e.g. "1/2 vs 1/3" or "2/4 = 1/2?". */
  readonly label: string;
  readonly expected: string;
  readonly claimed: string | null;
  readonly correct: boolean;
  readonly verdict: ValidationVerdict;
  readonly delivery: DeliveryOutcomeKind;
}

export interface SkillTally {
  readonly total: number;
  readonly correct: number;
}

export interface EvalSuiteReport {
  readonly generatorId: string;
  readonly validatorId: string;
  readonly validatorVersion: string;
  readonly total: number;
  readonly correct: number;
  readonly accuracy: number;
  readonly byVerdict: Record<ValidationVerdict, number>;
  readonly byDelivery: Record<DeliveryOutcomeKind, number>;
  readonly bySkill: Record<SuiteSkill, SkillTally>;
  readonly incorrect: number;
  readonly incorrectContained: number;
  /** True iff no incorrect answer was delivered — the gate property. */
  readonly containmentHeld: boolean;
  readonly generatedAt: string;
  readonly items: readonly EvalSuiteItem[];
}

export interface RunEvalSuiteParams {
  readonly tasks: readonly SuiteTask[];
  readonly generatorId: string;
  readonly validatorId: string;
  readonly validatorVersion: string;
  readonly generate: SuiteGenerate;
  readonly fallbackAssetId?: string | null;
  readonly now?: () => string;
}

const frac = (f: Fraction): string => `${f.numerator}/${f.denominator}`;

/**
 * A fixed synthetic suite across both skills. Comparison spans lt/gt/eq including
 * same-numerator, same-denominator, near-equal, improper and whole-number cases;
 * equivalence mixes equal and unequal pairs (incl. unreduced and improper). All
 * deterministic, so runs are reproducible and comparable across models.
 */
export const DEFAULT_EVAL_SUITE: readonly SuiteTask[] = [
  // comparison
  {
    kind: 'comparison',
    left: { numerator: 1, denominator: 2 },
    right: { numerator: 1, denominator: 3 },
  },
  {
    kind: 'comparison',
    left: { numerator: 1, denominator: 3 },
    right: { numerator: 1, denominator: 2 },
  },
  {
    kind: 'comparison',
    left: { numerator: 2, denominator: 4 },
    right: { numerator: 1, denominator: 2 },
  },
  {
    kind: 'comparison',
    left: { numerator: 3, denominator: 4 },
    right: { numerator: 2, denominator: 3 },
  },
  {
    kind: 'comparison',
    left: { numerator: 2, denominator: 5 },
    right: { numerator: 3, denominator: 5 },
  },
  {
    kind: 'comparison',
    left: { numerator: 5, denominator: 10 },
    right: { numerator: 1, denominator: 2 },
  },
  {
    kind: 'comparison',
    left: { numerator: 7, denominator: 8 },
    right: { numerator: 3, denominator: 4 },
  },
  {
    kind: 'comparison',
    left: { numerator: 1, denominator: 6 },
    right: { numerator: 1, denominator: 4 },
  },
  {
    kind: 'comparison',
    left: { numerator: 3, denominator: 5 },
    right: { numerator: 3, denominator: 7 },
  }, // same numerator
  {
    kind: 'comparison',
    left: { numerator: 4, denominator: 9 },
    right: { numerator: 5, denominator: 9 },
  }, // same denominator
  {
    kind: 'comparison',
    left: { numerator: 5, denominator: 8 },
    right: { numerator: 7, denominator: 11 },
  }, // near-equal
  {
    kind: 'comparison',
    left: { numerator: 9, denominator: 4 },
    right: { numerator: 7, denominator: 3 },
  }, // improper
  {
    kind: 'comparison',
    left: { numerator: 6, denominator: 3 },
    right: { numerator: 2, denominator: 1 },
  }, // whole, equal
  {
    kind: 'comparison',
    left: { numerator: 11, denominator: 12 },
    right: { numerator: 1, denominator: 1 },
  }, // vs whole
  // equivalence
  {
    kind: 'equivalence',
    left: { numerator: 2, denominator: 4 },
    right: { numerator: 1, denominator: 2 },
  }, // true
  {
    kind: 'equivalence',
    left: { numerator: 3, denominator: 6 },
    right: { numerator: 1, denominator: 2 },
  }, // true
  {
    kind: 'equivalence',
    left: { numerator: 2, denominator: 3 },
    right: { numerator: 3, denominator: 4 },
  }, // false
  {
    kind: 'equivalence',
    left: { numerator: 6, denominator: 9 },
    right: { numerator: 2, denominator: 3 },
  }, // true
  {
    kind: 'equivalence',
    left: { numerator: 4, denominator: 8 },
    right: { numerator: 1, denominator: 3 },
  }, // false
  {
    kind: 'equivalence',
    left: { numerator: 7, denominator: 8 },
    right: { numerator: 3, denominator: 4 },
  }, // false
  {
    kind: 'equivalence',
    left: { numerator: 10, denominator: 4 },
    right: { numerator: 5, denominator: 2 },
  }, // true (improper)
  {
    kind: 'equivalence',
    left: { numerator: 5, denominator: 10 },
    right: { numerator: 1, denominator: 2 },
  }, // true
];

export async function runEvalSuite(params: RunEvalSuiteParams): Promise<EvalSuiteReport> {
  const at = params.now ?? (() => new Date().toISOString());
  const common = {
    generatorId: params.generatorId,
    validatorId: params.validatorId,
    validatorVersion: params.validatorVersion,
    fallbackAssetId: params.fallbackAssetId ?? null,
    now: at,
  };

  const items: EvalSuiteItem[] = [];
  const byVerdict: Record<ValidationVerdict, number> = {
    PASS: 0,
    FAIL: 0,
    UNCERTAIN: 0,
    UNAVAILABLE: 0,
  };
  const byDelivery: Record<DeliveryOutcomeKind, number> = { DELIVER: 0, FALLBACK: 0, BLOCK: 0 };
  const bySkill: Record<SuiteSkill, { total: number; correct: number }> = {
    comparison: { total: 0, correct: 0 },
    equivalence: { total: 0, correct: 0 },
  };

  for (const task of params.tasks) {
    const answer = await params.generate(task);
    let item: EvalSuiteItem;

    if (task.kind === 'comparison') {
      const generated: GeneratedMathAnswer =
        answer.kind === 'comparison'
          ? { claimedAnswer: answer.claimedAnswer, explanation: answer.explanation }
          : { claimedAnswer: null, explanation: '' };
      const r = evaluateMathCandidate({ ...common, task, generated });
      const expected = trueRelation(task.left, task.right);
      const correct = r.claimedAnswer === expected;
      item = {
        kind: 'comparison',
        label: `${frac(task.left)} vs ${frac(task.right)}`,
        expected,
        claimed: r.claimedAnswer,
        correct,
        verdict: r.verdict,
        delivery: r.delivery,
      };
    } else {
      const generated: GeneratedEquivalenceAnswer =
        answer.kind === 'equivalence'
          ? { claimedEquivalent: answer.claimedEquivalent, explanation: answer.explanation }
          : { claimedEquivalent: null, explanation: '' };
      const r = evaluateEquivalenceCandidate({ ...common, task, generated });
      const expected = areEquivalent(task.left, task.right);
      const correct = r.claimedEquivalent === expected;
      item = {
        kind: 'equivalence',
        label: `${frac(task.left)} = ${frac(task.right)}?`,
        expected: String(expected),
        claimed: r.claimedEquivalent === null ? null : String(r.claimedEquivalent),
        correct,
        verdict: r.verdict,
        delivery: r.delivery,
      };
    }

    byVerdict[item.verdict] += 1;
    byDelivery[item.delivery] += 1;
    bySkill[item.kind].total += 1;
    if (item.correct) bySkill[item.kind].correct += 1;
    items.push(item);
  }

  const total = items.length;
  const correct = items.filter((i) => i.correct).length;
  const incorrect = total - correct;
  const incorrectContained = items.filter((i) => !i.correct && i.delivery !== 'DELIVER').length;

  return {
    generatorId: params.generatorId,
    validatorId: params.validatorId,
    validatorVersion: params.validatorVersion,
    total,
    correct,
    accuracy: total === 0 ? 0 : correct / total,
    byVerdict,
    byDelivery,
    bySkill,
    incorrect,
    incorrectContained,
    containmentHeld: incorrectContained === incorrect,
    generatedAt: at(),
    items,
  };
}
