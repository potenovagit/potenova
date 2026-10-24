import { describe, it, expect } from 'vitest';
import {
  buildProportionsG7DraftGraph,
  PROPORTIONS_G7_SKILLS,
  PROPORTIONS_G7_MISCONCEPTIONS,
  PROPORTIONS_G7_STRATEGIES,
} from '@potenova/curriculum';

describe('DRAFT proportional-reasoning strand (G7 B2.10)', () => {
  const g = buildProportionsG7DraftGraph();

  it('is a single-skill acyclic graph', () => {
    expect(g.hasCycle()).toBe(false);
    expect(g.skillCount()).toBe(PROPORTIONS_G7_SKILLS.length);
    expect(PROPORTIONS_G7_SKILLS.map((s) => s.skillId)).toEqual(['SK-NS-proportion-solve']);
  });

  it('seeds the additive-reasoning misconception tied to the skill, with a strategy', () => {
    const strategyIds = new Set(PROPORTIONS_G7_STRATEGIES.map((s) => s.strategyId));
    expect(PROPORTIONS_G7_MISCONCEPTIONS.length).toBeGreaterThanOrEqual(1);
    for (const mc of PROPORTIONS_G7_MISCONCEPTIONS) {
      expect(mc.skillId).toBe('SK-NS-proportion-solve');
      for (const sid of mc.remediationStrategyIds) expect(strategyIds.has(sid)).toBe(true);
    }
  });

  it('is a Number ratios graph', () => {
    expect(PROPORTIONS_G7_SKILLS.every((s) => s.domain === 'math')).toBe(true);
    expect(PROPORTIONS_G7_SKILLS.every((s) => s.competency === 'number:ratios')).toBe(true);
  });
});
