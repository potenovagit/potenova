import { describe, it, expect } from 'vitest';
import {
  buildPercentsG6DraftGraph,
  PERCENTS_G6_SKILLS,
  PERCENTS_G6_MISCONCEPTIONS,
  PERCENTS_G6_STRATEGIES,
} from '@potenova/curriculum';

describe('DRAFT percent-of-a-number strand (G6 exp 8)', () => {
  const g = buildPercentsG6DraftGraph();

  it('is a single-skill acyclic graph', () => {
    expect(g.hasCycle()).toBe(false);
    expect(g.skillCount()).toBe(PERCENTS_G6_SKILLS.length);
    expect(PERCENTS_G6_SKILLS.map((s) => s.skillId)).toEqual(['SK-NS-percent-of']);
  });

  it('seeds the place-value-slip misconception tied to the skill, with a strategy', () => {
    const strategyIds = new Set(PERCENTS_G6_STRATEGIES.map((s) => s.strategyId));
    expect(PERCENTS_G6_MISCONCEPTIONS.length).toBeGreaterThanOrEqual(1);
    for (const mc of PERCENTS_G6_MISCONCEPTIONS) {
      expect(mc.skillId).toBe('SK-NS-percent-of');
      for (const sid of mc.remediationStrategyIds) expect(strategyIds.has(sid)).toBe(true);
    }
  });

  it('is a Number percents graph', () => {
    expect(PERCENTS_G6_SKILLS.every((s) => s.domain === 'math')).toBe(true);
    expect(PERCENTS_G6_SKILLS.every((s) => s.competency === 'number:percents')).toBe(true);
  });
});
