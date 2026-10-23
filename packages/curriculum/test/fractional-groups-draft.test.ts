import { describe, it, expect } from 'vitest';
import {
  buildFractionalGroupsDraftGraph,
  FRACTIONAL_GROUPS_SKILLS,
  FRACTIONAL_GROUPS_MISCONCEPTIONS,
  FRACTIONAL_GROUPS_STRATEGIES,
} from '@potenova/curriculum';

describe('DRAFT fractional-groups strand (G3 exp 13)', () => {
  const g = buildFractionalGroupsDraftGraph();

  it('is a single-skill acyclic graph', () => {
    expect(g.hasCycle()).toBe(false);
    expect(g.skillCount()).toBe(FRACTIONAL_GROUPS_SKILLS.length);
    expect(FRACTIONAL_GROUPS_SKILLS.map((s) => s.skillId)).toEqual(['SK-FR-groups']);
  });

  it('seeds a counts-the-wholes misconception tied to the skill, with a strategy', () => {
    const strategyIds = new Set(FRACTIONAL_GROUPS_STRATEGIES.map((s) => s.strategyId));
    expect(FRACTIONAL_GROUPS_MISCONCEPTIONS.length).toBeGreaterThanOrEqual(1);
    for (const mc of FRACTIONAL_GROUPS_MISCONCEPTIONS) {
      expect(mc.skillId).toBe('SK-FR-groups');
      for (const sid of mc.remediationStrategyIds) expect(strategyIds.has(sid)).toBe(true);
    }
  });

  it('is a Number fractions graph', () => {
    expect(FRACTIONAL_GROUPS_SKILLS.every((s) => s.domain === 'math')).toBe(true);
    expect(FRACTIONAL_GROUPS_SKILLS.every((s) => s.competency === 'number:fractions')).toBe(true);
  });
});
