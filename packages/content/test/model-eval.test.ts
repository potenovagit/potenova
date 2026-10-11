import { describe, it, expect } from 'vitest';
import { isDomainError } from '@potenova/contracts';
import { evaluateMathCandidate, parseGeneratedMathAnswer } from '../src/model-eval';

/**
 * Candidate model evaluation on synthetic data (AI-003). The model is the
 * generator; the deterministic Math oracle is the independent validator. The
 * three outcomes — correct → PASS/DELIVER, wrong → FAIL/BLOCK, unparseable →
 * UNCERTAIN/FALLBACK — are all driven purely by the oracle, and no path ever
 * delivers to a child.
 */

const TASK = { left: { numerator: 1, denominator: 2 }, right: { numerator: 1, denominator: 3 } };
const base = {
  task: TASK,
  generatorId: 'azure-openai:tutor-mini',
  validatorId: 'math-oracle:fractions',
  validatorVersion: 'v1',
  now: () => '2026-10-11T00:00:00Z',
} as const;

describe('evaluateMathCandidate', () => {
  it('a correct answer PASSES and is cleared to DELIVER (eval-only, not to a child)', () => {
    const r = evaluateMathCandidate({
      ...base,
      generated: { claimedAnswer: 'gt', explanation: '1/2 > 1/3' },
    });
    expect(r.groundTruth).toBe('gt');
    expect(r.verdict).toBe('PASS');
    expect(r.delivery).toBe('DELIVER');
    expect(r.deliveredToChild).toBe(false);
  });

  it('a wrong answer FAILS and is BLOCKED', () => {
    const r = evaluateMathCandidate({
      ...base,
      generated: { claimedAnswer: 'lt', explanation: 'wrong' },
    });
    expect(r.verdict).toBe('FAIL');
    expect(r.reasonCodes).toContain('MATH_ANSWER_KEY_WRONG');
    expect(r.delivery).toBe('BLOCK');
    expect(r.deliveredToChild).toBe(false);
  });

  it('an unparseable answer is UNCERTAIN → BLOCK without a fallback', () => {
    const r = evaluateMathCandidate({
      ...base,
      generated: { claimedAnswer: null, explanation: 'gibberish' },
    });
    expect(r.verdict).toBe('UNCERTAIN');
    expect(r.delivery).toBe('BLOCK');
  });

  it('an unparseable answer serves an approved FALLBACK when one is supplied', () => {
    const r = evaluateMathCandidate({
      ...base,
      generated: { claimedAnswer: null, explanation: 'gibberish' },
      fallbackAssetId: 'asset-approved-1',
    });
    expect(r.verdict).toBe('UNCERTAIN');
    expect(r.delivery).toBe('FALLBACK');
  });

  it('refuses when the generator tries to validate itself (no self-blessing)', () => {
    try {
      evaluateMathCandidate({
        ...base,
        validatorId: base.generatorId,
        generated: { claimedAnswer: 'gt', explanation: 'x' },
      });
      expect.unreachable('should have thrown');
    } catch (e) {
      expect(isDomainError(e) && e.code).toBe('POLICY_BLOCKED');
    }
  });
});

describe('parseGeneratedMathAnswer', () => {
  it('parses plain JSON', () => {
    expect(parseGeneratedMathAnswer('{"answer":"gt","explanation":"bigger"}')).toEqual({
      claimedAnswer: 'gt',
      explanation: 'bigger',
    });
  });

  it('tolerates markdown code fences', () => {
    const r = parseGeneratedMathAnswer('```json\n{"answer":"eq","explanation":"same"}\n```');
    expect(r.claimedAnswer).toBe('eq');
  });

  it('returns null answer for an invalid relation', () => {
    expect(parseGeneratedMathAnswer('{"answer":"maybe"}').claimedAnswer).toBeNull();
  });

  it('returns null answer for non-JSON and keeps the raw text as explanation', () => {
    const r = parseGeneratedMathAnswer('I think the left one is bigger');
    expect(r.claimedAnswer).toBeNull();
    expect(r.explanation).toContain('bigger');
  });
});
