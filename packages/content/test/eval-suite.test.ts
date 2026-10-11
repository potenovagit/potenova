import { describe, it, expect } from 'vitest';
import {
  runMathEvalSuite,
  DEFAULT_MATH_EVAL_SUITE,
  type GenerateMathAnswer,
} from '../src/eval-suite';
import { trueRelation } from '../src/math-check';

/**
 * The evaluation harness aggregates many synthetic tasks through the same
 * generator→oracle→gate path. The key properties: accuracy is reported honestly,
 * and every WRONG answer is contained (never DELIVER) — a wrong answer that
 * reached a child would be a containment failure.
 */

const base = {
  generatorId: 'cand-model',
  validatorId: 'math-oracle:fractions',
  validatorVersion: 'v1',
  now: () => '2026-10-11T00:00:00Z',
} as const;

/** A perfect model: always answers the true relation. */
const perfect: GenerateMathAnswer = async (task) => ({
  claimedAnswer: trueRelation(task.left, task.right),
  explanation: 'ground truth',
});

/** A model that always says 'gt' — wrong on every lt/eq task. */
const alwaysGt: GenerateMathAnswer = async () => ({ claimedAnswer: 'gt', explanation: 'gt' });

describe('runMathEvalSuite', () => {
  it('scores a perfect model at 100% accuracy, all delivered', async () => {
    const r = await runMathEvalSuite({
      ...base,
      tasks: DEFAULT_MATH_EVAL_SUITE,
      generate: perfect,
    });
    expect(r.total).toBe(DEFAULT_MATH_EVAL_SUITE.length);
    expect(r.correct).toBe(r.total);
    expect(r.accuracy).toBe(1);
    expect(r.byDelivery.DELIVER).toBe(r.total);
    expect(r.incorrect).toBe(0);
    expect(r.containmentHeld).toBe(true);
  });

  it('contains every wrong answer from a biased model (none delivered)', async () => {
    const r = await runMathEvalSuite({
      ...base,
      tasks: DEFAULT_MATH_EVAL_SUITE,
      generate: alwaysGt,
    });
    expect(r.correct).toBeLessThan(r.total);
    expect(r.incorrect).toBeGreaterThan(0);
    // Every incorrect answer must be BLOCKed (FAIL) — never delivered.
    expect(r.incorrectContained).toBe(r.incorrect);
    expect(r.containmentHeld).toBe(true);
    expect(r.byDelivery.DELIVER).toBe(r.correct);
  });

  it('counts an unparseable answer as incorrect and contained (UNCERTAIN)', async () => {
    const r = await runMathEvalSuite({
      ...base,
      tasks: [DEFAULT_MATH_EVAL_SUITE[0]],
      generate: async () => ({ claimedAnswer: null, explanation: 'garbage' }),
    });
    expect(r.byVerdict.UNCERTAIN).toBe(1);
    expect(r.byDelivery.BLOCK).toBe(1);
    expect(r.containmentHeld).toBe(true);
  });
});
