import { describe, it, expect } from 'vitest';
import {
  buildSqrtEstimateG8DraftGraph,
  SQRT_ESTIMATE_G8_SKILLS,
  SQRT_ESTIMATE_G8_MISCONCEPTIONS,
  SQRT_ESTIMATE_G8_STRATEGIES,
} from '@potenova/curriculum';

describe('DRAFT square-root estimation strand (G8 B1.3)', () => {
  const g = buildSqrtEstimateG8DraftGraph();

  it('is a single-skill acyclic graph', () => {
    expect(g.hasCycle()).toBe(false);
    expect(g.skillCount()).toBe(SQRT_ESTIMATE_G8_SKILLS.length);
    expect(SQRT_ESTIMATE_G8_SKILLS.map((s) => s.skillId)).toEqual(['SK-NS-sqrt-between']);
  });

  it('seeds the sqrt-is-half misconception tied to the skill, with a strategy', () => {
    const strategyIds = new Set(SQRT_ESTIMATE_G8_STRATEGIES.map((s) => s.strategyId));
    expect(SQRT_ESTIMATE_G8_MISCONCEPTIONS.length).toBeGreaterThanOrEqual(1);
    for (const mc of SQRT_ESTIMATE_G8_MISCONCEPTIONS) {
      expect(mc.skillId).toBe('SK-NS-sqrt-between');
      for (const sid of mc.remediationStrategyIds) expect(strategyIds.has(sid)).toBe(true);
    }
  });

  it('is a Number powers graph', () => {
    expect(SQRT_ESTIMATE_G8_SKILLS.every((s) => s.domain === 'math')).toBe(true);
    expect(SQRT_ESTIMATE_G8_SKILLS.every((s) => s.competency === 'number:powers')).toBe(true);
  });
});
