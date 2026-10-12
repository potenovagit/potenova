import { describe, it, expect } from 'vitest';
import { runEvalSuite, DEFAULT_EVAL_SUITE, type SuiteGenerate } from '../src/eval-suite';
import { trueRelation, areEquivalent } from '../src/math-check';

/**
 * The evaluation harness aggregates many synthetic tasks across two skills
 * (comparison + equivalence) through the same generator→oracle→gate path. The
 * key properties: accuracy is reported honestly per skill, and every WRONG
 * answer is contained (never DELIVER).
 */

const base = {
  generatorId: 'cand-model',
  validatorId: 'math-oracle:fractions',
  validatorVersion: 'v1',
  now: () => '2026-10-11T00:00:00Z',
} as const;

/** A perfect model: always answers the true relation / equivalence. */
const perfect: SuiteGenerate = async (task) =>
  task.kind === 'comparison'
    ? { kind: 'comparison', claimedAnswer: trueRelation(task.left, task.right), explanation: 'x' }
    : {
        kind: 'equivalence',
        claimedEquivalent: areEquivalent(task.left, task.right),
        explanation: 'x',
      };

/** A biased model: always 'gt' / always 'equivalent' — wrong on many tasks. */
const biased: SuiteGenerate = async (task) =>
  task.kind === 'comparison'
    ? { kind: 'comparison', claimedAnswer: 'gt', explanation: 'gt' }
    : { kind: 'equivalence', claimedEquivalent: true, explanation: 'yes' };

describe('runEvalSuite', () => {
  it('scores a perfect model at 100% across both skills, all delivered', async () => {
    const r = await runEvalSuite({ ...base, tasks: DEFAULT_EVAL_SUITE, generate: perfect });
    expect(r.total).toBe(DEFAULT_EVAL_SUITE.length);
    expect(r.accuracy).toBe(1);
    expect(r.byDelivery.DELIVER).toBe(r.total);
    expect(r.incorrect).toBe(0);
    expect(r.containmentHeld).toBe(true);
    expect(r.bySkill.comparison.total).toBeGreaterThan(0);
    expect(r.bySkill.equivalence.total).toBeGreaterThan(0);
    expect(r.bySkill.comparison.correct).toBe(r.bySkill.comparison.total);
    expect(r.bySkill.equivalence.correct).toBe(r.bySkill.equivalence.total);
  });

  it('contains every wrong answer from a biased model (none delivered)', async () => {
    const r = await runEvalSuite({ ...base, tasks: DEFAULT_EVAL_SUITE, generate: biased });
    expect(r.correct).toBeLessThan(r.total);
    expect(r.incorrect).toBeGreaterThan(0);
    expect(r.incorrectContained).toBe(r.incorrect);
    expect(r.containmentHeld).toBe(true);
    expect(r.byDelivery.DELIVER).toBe(r.correct);
  });

  it('summarizes end-to-end latency with an injected clock (ER-05/NFR-11)', async () => {
    // Monotonic clock advancing 5ms per read → a deterministic 5ms per task
    // (each task reads the clock once before and once after generate).
    let t = 0;
    const clock = (): number => {
      const v = t;
      t += 5;
      return v;
    };
    const r = await runEvalSuite({
      ...base,
      tasks: DEFAULT_EVAL_SUITE,
      generate: perfect,
      clock,
    });
    expect(r.latency.count).toBe(r.total);
    expect(r.latency.p50Ms).toBe(5);
    expect(r.latency.p95Ms).toBe(5);
    expect(r.latency.maxMs).toBe(5);
    expect(r.items.every((i) => i.latencyMs === 5)).toBe(true);
  });

  it('counts an unparseable answer as incorrect and contained (UNCERTAIN)', async () => {
    const r = await runEvalSuite({
      ...base,
      tasks: [DEFAULT_EVAL_SUITE[0]], // a comparison task
      generate: async () => ({ kind: 'comparison', claimedAnswer: null, explanation: 'garbage' }),
    });
    expect(r.byVerdict.UNCERTAIN).toBe(1);
    expect(r.byDelivery.BLOCK).toBe(1);
    expect(r.containmentHeld).toBe(true);
  });
});
