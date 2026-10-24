import { describe, it, expect } from 'vitest';
import {
  buildFractionsG5DraftGraph,
  FRACTIONS_G5_SKILLS,
  FRACTIONS_G5_MISCONCEPTIONS,
  FRACTIONS_G5_STRATEGIES,
} from '@potenova/curriculum';

describe('DRAFT fractions-add/subtract-like strand (G5 exp 11)', () => {
  const g = buildFractionsG5DraftGraph();

  it('is a single-skill acyclic graph', () => {
    expect(g.hasCycle()).toBe(false);
    expect(g.skillCount()).toBe(FRACTIONS_G5_SKILLS.length);
    expect(FRACTIONS_G5_SKILLS.map((s) => s.skillId)).toEqual(['SK-NS-fraction-addsub-like']);
  });

  it('seeds an adds-the-denominators misconception tied to the skill, with a strategy', () => {
    const strategyIds = new Set(FRACTIONS_G5_STRATEGIES.map((s) => s.strategyId));
    expect(FRACTIONS_G5_MISCONCEPTIONS.length).toBeGreaterThanOrEqual(1);
    for (const mc of FRACTIONS_G5_MISCONCEPTIONS) {
      expect(mc.skillId).toBe('SK-NS-fraction-addsub-like');
      for (const sid of mc.remediationStrategyIds) expect(strategyIds.has(sid)).toBe(true);
    }
  });

  it('is a Number fractions graph', () => {
    expect(FRACTIONS_G5_SKILLS.every((s) => s.domain === 'math')).toBe(true);
    expect(FRACTIONS_G5_SKILLS.every((s) => s.competency === 'number:fractions')).toBe(true);
  });
});
