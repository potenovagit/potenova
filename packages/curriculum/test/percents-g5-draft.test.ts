import { describe, it, expect } from 'vitest';
import {
  buildPercentsG5DraftGraph,
  PERCENTS_G5_SKILLS,
  PERCENTS_G5_MISCONCEPTIONS,
  PERCENTS_G5_STRATEGIES,
} from '@potenova/curriculum';

describe('DRAFT fraction↔percent strand (G5 exp 6)', () => {
  const g = buildPercentsG5DraftGraph();

  it('is a single-skill acyclic graph', () => {
    expect(g.hasCycle()).toBe(false);
    expect(g.skillCount()).toBe(PERCENTS_G5_SKILLS.length);
    expect(PERCENTS_G5_SKILLS.map((s) => s.skillId)).toEqual(['SK-NS-fraction-percent-equiv']);
  });

  it('seeds a numerator-as-percent misconception tied to the skill, with a strategy', () => {
    const strategyIds = new Set(PERCENTS_G5_STRATEGIES.map((s) => s.strategyId));
    expect(PERCENTS_G5_MISCONCEPTIONS.length).toBeGreaterThanOrEqual(1);
    for (const mc of PERCENTS_G5_MISCONCEPTIONS) {
      expect(mc.skillId).toBe('SK-NS-fraction-percent-equiv');
      for (const sid of mc.remediationStrategyIds) expect(strategyIds.has(sid)).toBe(true);
    }
  });

  it('is a Number percent graph', () => {
    expect(PERCENTS_G5_SKILLS.every((s) => s.domain === 'math')).toBe(true);
    expect(PERCENTS_G5_SKILLS.every((s) => s.competency === 'number:percent')).toBe(true);
  });
});
