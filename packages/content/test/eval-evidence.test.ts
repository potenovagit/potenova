import { describe, it, expect } from 'vitest';
import { runMathEvalSuite, DEFAULT_MATH_EVAL_SUITE } from '../src/eval-suite';
import { buildEvalEvidence, renderEvalEvidenceMarkdown } from '../src/eval-evidence';
import { trueRelation } from '../src/math-check';

const base = {
  generatorId: 'cand-model',
  validatorId: 'math-oracle:fractions',
  validatorVersion: 'v1',
  now: () => '2026-10-11T00:00:00Z',
} as const;

async function reportFor(answer: 'perfect' | 'alwaysGt') {
  return runMathEvalSuite({
    ...base,
    tasks: DEFAULT_MATH_EVAL_SUITE,
    generate:
      answer === 'perfect'
        ? async (task) => ({ claimedAnswer: trueRelation(task.left, task.right), explanation: 'x' })
        : async () => ({ claimedAnswer: 'gt', explanation: 'gt' }),
  });
}

describe('buildEvalEvidence', () => {
  it('produces a PASS gate artifact with synthetic fixture ids and no child delivery', async () => {
    const report = await reportFor('perfect');
    const a = buildEvalEvidence({
      report,
      model: 'azure-openai:tutor-mini',
      processingRegion: 'ca-east',
      runId: 'run-test',
      tokenUnits: 42,
    });
    expect(a.gate).toBe('G2');
    expect(a.requirementId).toBe('AI-003');
    expect(a.synthetic).toBe(true);
    expect(a.deliveredToChild).toBe(false);
    expect(a.result).toBe('PASS');
    expect(a.syntheticFixtureIds).toHaveLength(report.total);
    expect(a.syntheticFixtureIds[0]).toMatch(/^SYN-FRAC-/);
    expect(a.reviewer).toBeNull();
  });

  it('still PASSES when the model is wrong, because wrong answers were contained', async () => {
    const report = await reportFor('alwaysGt');
    const a = buildEvalEvidence({
      report,
      model: 'm',
      processingRegion: 'ca-east',
      runId: 'r',
    });
    // Containment, not accuracy, is the gate property.
    expect(report.accuracy).toBeLessThan(1);
    expect(a.result).toBe('PASS');
    expect(renderEvalEvidenceMarkdown(a)).toContain('Result: **PASS**');
  });
});
