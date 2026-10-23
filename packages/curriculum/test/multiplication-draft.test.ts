import { describe, it, expect } from 'vitest';
import {
  buildMultiplicationDraftGraph,
  MULTIPLICATION_SKILLS,
  MULTIPLICATION_MISCONCEPTIONS,
  MULTIPLICATION_STRATEGIES,
} from '@potenova/curriculum';

describe('DRAFT multiplication-facts strand (G3 B2.4)', () => {
  const g = buildMultiplicationDraftGraph();

  it('is a single-skill acyclic graph', () => {
    expect(g.hasCycle()).toBe(false);
    expect(g.skillCount()).toBe(MULTIPLICATION_SKILLS.length);
    expect(MULTIPLICATION_SKILLS.map((s) => s.skillId)).toEqual(['SK-NS-mult-facts']);
  });

  it('seeds an adds-instead-of-multiplies misconception tied to the skill, with a strategy', () => {
    const strategyIds = new Set(MULTIPLICATION_STRATEGIES.map((s) => s.strategyId));
    expect(MULTIPLICATION_MISCONCEPTIONS.length).toBeGreaterThanOrEqual(1);
    for (const mc of MULTIPLICATION_MISCONCEPTIONS) {
      expect(mc.skillId).toBe('SK-NS-mult-facts');
      for (const sid of mc.remediationStrategyIds) expect(strategyIds.has(sid)).toBe(true);
    }
  });

  it('is a Number multiplication graph', () => {
    expect(MULTIPLICATION_SKILLS.every((s) => s.domain === 'math')).toBe(true);
    expect(MULTIPLICATION_SKILLS.every((s) => s.competency === 'number:multiplication')).toBe(true);
  });
});
