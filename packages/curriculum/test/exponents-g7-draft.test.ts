import { describe, it, expect } from 'vitest';
import {
  buildExponentsG7DraftGraph,
  EXPONENTS_G7_SKILLS,
  EXPONENTS_G7_MISCONCEPTIONS,
  EXPONENTS_G7_STRATEGIES,
} from '@potenova/curriculum';

describe('DRAFT exponents strand (G7 B2.7)', () => {
  const g = buildExponentsG7DraftGraph();

  it('is a single-skill acyclic graph', () => {
    expect(g.hasCycle()).toBe(false);
    expect(g.skillCount()).toBe(EXPONENTS_G7_SKILLS.length);
    expect(EXPONENTS_G7_SKILLS.map((s) => s.skillId)).toEqual(['SK-NS-power-eval']);
  });

  it('seeds the base×exponent misconception tied to the skill, with a strategy', () => {
    const strategyIds = new Set(EXPONENTS_G7_STRATEGIES.map((s) => s.strategyId));
    expect(EXPONENTS_G7_MISCONCEPTIONS.length).toBeGreaterThanOrEqual(1);
    for (const mc of EXPONENTS_G7_MISCONCEPTIONS) {
      expect(mc.skillId).toBe('SK-NS-power-eval');
      for (const sid of mc.remediationStrategyIds) expect(strategyIds.has(sid)).toBe(true);
    }
  });

  it('is a Number powers graph', () => {
    expect(EXPONENTS_G7_SKILLS.every((s) => s.domain === 'math')).toBe(true);
    expect(EXPONENTS_G7_SKILLS.every((s) => s.competency === 'number:powers')).toBe(true);
  });
});
