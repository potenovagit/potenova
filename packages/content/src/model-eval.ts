import {
  decideDelivery,
  type CandidateContent,
  type ValidationVerdict,
} from '@potenova/domain-core';
import { checkMathTask, trueRelation, type Fraction, type FractionRelation } from './math-check';
import { validateCandidate, validationRecordRef } from './validation';

/**
 * Candidate model evaluation on SYNTHETIC data (AI-003; ADR-0005/0006).
 *
 * A candidate (non-approved) model is the GENERATOR; the deterministic Math
 * oracle (`checkMathTask`) is the INDEPENDENT validator. Its answer is scored,
 * validated and run through the child-facing content gate purely to measure the
 * model — the outcome is NEVER delivered to a child (`deliveredToChild: false`).
 * This is how we exercise a real model behind the gateway before ER-16 clears,
 * without touching a production child path or real child data.
 */

export interface MathEvalTask {
  readonly left: Fraction;
  readonly right: Fraction;
}

export interface GeneratedMathAnswer {
  /** Parsed from the model's output; null when it could not be parsed. */
  readonly claimedAnswer: FractionRelation | null;
  readonly explanation: string;
}

export interface MathEvalParams {
  readonly task: MathEvalTask;
  /** The candidate model under test. */
  readonly generatorId: string;
  /** The independent validator — MUST differ from generatorId. */
  readonly validatorId: string;
  readonly validatorVersion: string;
  readonly generated: GeneratedMathAnswer;
  /** Approved fallback asset to serve when the candidate is not PASS (optional). */
  readonly fallbackAssetId?: string | null;
  readonly now?: () => string;
}

export interface MathEvalResult {
  readonly generatorId: string;
  readonly groundTruth: FractionRelation;
  readonly claimedAnswer: FractionRelation | null;
  readonly explanation: string;
  readonly verdict: ValidationVerdict;
  readonly reasonCodes: readonly string[];
  readonly delivery: DeliveryOutcomeKind;
  /** Invariant: candidate evaluation is never a child-delivery path. */
  readonly deliveredToChild: false;
}

export type DeliveryOutcomeKind = 'DELIVER' | 'FALLBACK' | 'BLOCK';

/**
 * Evaluate a candidate model's answer to a synthetic fraction-comparison task.
 *
 * @throws DomainError POLICY_BLOCKED — generatorId === validatorId (no self-blessing).
 */
export function evaluateMathCandidate(params: MathEvalParams): MathEvalResult {
  const { left, right } = params.task;
  const groundTruth = trueRelation(left, right);
  const parsed = params.generated.claimedAnswer !== null;

  // The deterministic oracle is the independent validator. When the model's
  // answer could not be parsed, the oracle has no comparable claim → inconclusive
  // (correct: null), which drives an UNCERTAIN verdict and a non-delivery outcome.
  const correct = parsed
    ? checkMathTask({
        kind: 'fraction_comparison',
        left,
        right,
        claimedAnswer: params.generated.claimedAnswer as FractionRelation,
      }).correct
    : null;

  const record = validateCandidate(
    {
      candidateId: `eval:${params.generatorId}`,
      generatorId: params.generatorId,
      validatorId: params.validatorId,
      validatorVersion: params.validatorVersion,
      math: { ran: true, correct },
      // Synthetic Math-oracle eval: no free-form child text is produced, so the
      // conversational safety screen trivially holds. The real safety validator
      // is a separate ER-16 concern and is not stubbed "pass" on any child path.
      safety: { available: true, pass: true },
      onTopic: true,
    },
    params.now,
  );

  const candidate: CandidateContent = {
    candidateId: record.candidateId,
    verdict: record.verdict,
    validationRecordRef: validationRecordRef(record),
  };

  const delivery = decideDelivery(
    candidate,
    params.fallbackAssetId ? { assetId: params.fallbackAssetId } : null,
  );

  return {
    generatorId: params.generatorId,
    groundTruth,
    claimedAnswer: params.generated.claimedAnswer,
    explanation: params.generated.explanation,
    verdict: record.verdict,
    reasonCodes: record.reasonCodes,
    delivery: delivery.kind,
    deliveredToChild: false,
  };
}

/**
 * The prompt pair used to ask a model for a fraction comparison. Kept here so the
 * single-task route and the evaluation suite ask the model identically, and so the
 * expected JSON shape stays in lock-step with `parseGeneratedMathAnswer`.
 */
export function buildComparisonPrompt(task: MathEvalTask): { system: string; prompt: string } {
  return {
    system:
      'You are a grade-school math checker. Compare the LEFT fraction to the RIGHT fraction. ' +
      'Respond with ONLY compact JSON: {"answer":"lt"|"eq"|"gt","explanation":"<one sentence>"} ' +
      'where the answer is LEFT relative to RIGHT (lt = LEFT is smaller, gt = LEFT is larger, eq = equal).',
    prompt:
      `LEFT = ${task.left.numerator}/${task.left.denominator}, ` +
      `RIGHT = ${task.right.numerator}/${task.right.denominator}.`,
  };
}

/**
 * Parse a model's structured reply to a fraction-comparison prompt.
 *
 * Expects JSON `{ "answer": "lt"|"eq"|"gt", "explanation": "..." }`, tolerating
 * Markdown code fences. Returns `claimedAnswer: null` when no valid relation can
 * be extracted — the eval then treats the candidate as inconclusive rather than
 * guessing on its behalf.
 */
export function parseGeneratedMathAnswer(text: string): GeneratedMathAnswer {
  const stripped = text
    .replace(/```(?:json)?/gi, '')
    .replace(/```/g, '')
    .trim();

  let answer: FractionRelation | null = null;
  let explanation = '';

  try {
    const parsed = JSON.parse(stripped) as { answer?: unknown; explanation?: unknown };
    if (parsed.answer === 'lt' || parsed.answer === 'eq' || parsed.answer === 'gt') {
      answer = parsed.answer;
    }
    if (typeof parsed.explanation === 'string') {
      explanation = parsed.explanation;
    }
  } catch {
    // Not JSON — leave answer null; fall back to the raw text as the explanation.
    explanation = stripped.slice(0, 2000);
  }

  return { claimedAnswer: answer, explanation };
}
