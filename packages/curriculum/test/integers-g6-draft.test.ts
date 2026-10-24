import { describe, it, expect } from 'vitest';
import {
  buildIntegersG6DraftGraph,
  INTEGERS_G6_SKILLS,
  INTEGERS_G6_MISCONCEPTIONS,
  INTEGERS_G6_STRATEGIES,
} from '@potenova/curriculum';

describe('DRAFT integers strand (G6 exp 2)', () => {
  const g = buildIntegersG6DraftGraph();

  it('is a single-skill acyclic graph', () => {
    expect(g.hasCycle()).toBe(false);
    expect(g.skillCount()).toBe(INTEGERS_G6_SKILLS.length);
    expect(INTEGERS_G6_SKILLS.map((s) => s.skillId)).toEqual(['SK-NS-integer-signed-compare']);
  });

  it('seeds a larger-magnitude misconception tied to the skill, with a strategy', () => {
    const strategyIds = new Set(INTEGERS_G6_STRATEGIES.map((s) => s.strategyId));
    expect(INTEGERS_G6_MISCONCEPTIONS.length).toBeGreaterThanOrEqual(1);
    for (const mc of INTEGERS_G6_MISCONCEPTIONS) {
      expect(mc.skillId).toBe('SK-NS-integer-signed-compare');
      for (const sid of mc.remediationStrategyIds) expect(strategyIds.has(sid)).toBe(true);
    }
  });

  it('is a Number integers graph', () => {
    expect(INTEGERS_G6_SKILLS.every((s) => s.domain === 'math')).toBe(true);
    expect(INTEGERS_G6_SKILLS.every((s) => s.competency === 'number:integers')).toBe(true);
  });
});
