import { describe, it, expect } from 'vitest';
import {
  buildFractionsG6DraftGraph,
  FRACTIONS_G6_SKILLS,
  FRACTIONS_G6_MISCONCEPTIONS,
  FRACTIONS_G6_STRATEGIES,
} from '@potenova/curriculum';

describe('DRAFT unlike-denominator fractions strand (G6 exp 10)', () => {
  const g = buildFractionsG6DraftGraph();

  it('is a single-skill acyclic graph', () => {
    expect(g.hasCycle()).toBe(false);
    expect(g.skillCount()).toBe(FRACTIONS_G6_SKILLS.length);
    expect(FRACTIONS_G6_SKILLS.map((s) => s.skillId)).toEqual(['SK-NS-fraction-addsub-unlike']);
  });

  it('seeds the add-straight-across misconception tied to the skill, with a strategy', () => {
    const strategyIds = new Set(FRACTIONS_G6_STRATEGIES.map((s) => s.strategyId));
    expect(FRACTIONS_G6_MISCONCEPTIONS.length).toBeGreaterThanOrEqual(1);
    for (const mc of FRACTIONS_G6_MISCONCEPTIONS) {
      expect(mc.skillId).toBe('SK-NS-fraction-addsub-unlike');
      for (const sid of mc.remediationStrategyIds) expect(strategyIds.has(sid)).toBe(true);
    }
  });

  it('is a Number fractions graph', () => {
    expect(FRACTIONS_G6_SKILLS.every((s) => s.domain === 'math')).toBe(true);
    expect(FRACTIONS_G6_SKILLS.every((s) => s.competency === 'number:fractions')).toBe(true);
  });
});
