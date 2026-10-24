import { describe, it, expect } from 'vitest';
import {
  buildFractionsMulDivG7DraftGraph,
  FRACTIONS_MULDIV_G7_SKILLS,
  FRACTIONS_MULDIV_G7_MISCONCEPTIONS,
  FRACTIONS_MULDIV_G7_STRATEGIES,
} from '@potenova/curriculum';

describe('DRAFT fraction multiply/divide strand (G7 B2.8)', () => {
  const g = buildFractionsMulDivG7DraftGraph();

  it('is a single-skill acyclic graph', () => {
    expect(g.hasCycle()).toBe(false);
    expect(g.skillCount()).toBe(FRACTIONS_MULDIV_G7_SKILLS.length);
    expect(FRACTIONS_MULDIV_G7_SKILLS.map((s) => s.skillId)).toEqual(['SK-NS-fraction-muldiv']);
  });

  it('seeds the divide-without-reciprocal misconception tied to the skill, with a strategy', () => {
    const strategyIds = new Set(FRACTIONS_MULDIV_G7_STRATEGIES.map((s) => s.strategyId));
    expect(FRACTIONS_MULDIV_G7_MISCONCEPTIONS.length).toBeGreaterThanOrEqual(1);
    for (const mc of FRACTIONS_MULDIV_G7_MISCONCEPTIONS) {
      expect(mc.skillId).toBe('SK-NS-fraction-muldiv');
      for (const sid of mc.remediationStrategyIds) expect(strategyIds.has(sid)).toBe(true);
    }
  });

  it('is a Number fractions graph', () => {
    expect(FRACTIONS_MULDIV_G7_SKILLS.every((s) => s.domain === 'math')).toBe(true);
    expect(FRACTIONS_MULDIV_G7_SKILLS.every((s) => s.competency === 'number:fractions')).toBe(true);
  });
});
