import { describe, it, expect } from 'vitest';
import { runEvalSuite, DEFAULT_EVAL_SUITE, type SuiteGenerate } from '../src/eval-suite';
import { buildEvalEvidence, renderEvalEvidenceMarkdown } from '../src/eval-evidence';
import { trueRelation, areEquivalent } from '../src/math-check';

const base = {
  generatorId: 'cand-model',
  validatorId: 'math-oracle:fractions',
  validatorVersion: 'v1',
  now: () => '2026-10-11T00:00:00Z',
} as const;

const perfect: SuiteGenerate = async (task) =>
  task.kind === 'comparison'
    ? { kind: 'comparison', claimedAnswer: trueRelation(task.left, task.right), explanation: 'x' }
    : {
        kind: 'equivalence',
        claimedEquivalent: areEquivalent(task.left, task.right),
        explanation: 'x',
      };

const biased: SuiteGenerate = async (task) =>
  task.kind === 'comparison'
    ? { kind: 'comparison', claimedAnswer: 'gt', explanation: 'gt' }
    : { kind: 'equivalence', claimedEquivalent: true, explanation: 'yes' };

describe('buildEvalEvidence', () => {
  it('produces a PASS gate artifact with per-skill scores and no child delivery', async () => {
    const report = await runEvalSuite({ ...base, tasks: DEFAULT_EVAL_SUITE, generate: perfect });
    const a = buildEvalEvidence({
      report,
      model: 'azure-openai:tutor-mini',
      processingRegion: 'ca-east',
      runId: 'run-test',
      tokenUnits: 42,
    });
    expect(a.gate).toBe('G2');
    expect(a.requirementId).toBe('AI-003');
    expect(a.deliveredToChild).toBe(false);
    expect(a.result).toBe('PASS');
    expect(a.syntheticFixtureIds).toHaveLength(report.total);
    expect(a.syntheticFixtureIds[0]).toMatch(/^SYN-(COMPARISON|EQUIVALENCE)-/);
    expect(a.actual.bySkill.comparison.total).toBeGreaterThan(0);
    expect(a.actual.bySkill.equivalence.total).toBeGreaterThan(0);
    expect(a.reviewer).toBeNull();
  });

  it('still PASSES when the model is wrong, because wrong answers were contained', async () => {
    const report = await runEvalSuite({ ...base, tasks: DEFAULT_EVAL_SUITE, generate: biased });
    const a = buildEvalEvidence({ report, model: 'm', processingRegion: 'ca-east', runId: 'r' });
    expect(report.accuracy).toBeLessThan(1);
    expect(a.result).toBe('PASS');
    const md = renderEvalEvidenceMarkdown(a);
    expect(md).toContain('Result: **PASS**');
    expect(md).toContain('By skill:');
  });
});
