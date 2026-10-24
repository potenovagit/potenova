import { describe, it, expect } from 'vitest';
import {
  buildMultiplicationG5DraftGraph,
  MULTIPLICATION_G5_SKILLS,
  MULTIPLICATION_G5_MISCONCEPTIONS,
  MULTIPLICATION_G5_STRATEGIES,
} from '@potenova/curriculum';

describe('DRAFT 2-digit × 2-digit multiplication strand (G5 exp 12)', () => {
  const g = buildMultiplicationG5DraftGraph();

  it('is a single-skill acyclic graph', () => {
    expect(g.hasCycle()).toBe(false);
    expect(g.skillCount()).toBe(MULTIPLICATION_G5_SKILLS.length);
    expect(MULTIPLICATION_G5_SKILLS.map((s) => s.skillId)).toEqual(['SK-NS-mult-2x2']);
  });

  it('seeds a one-partial-product misconception tied to the skill, with a strategy', () => {
    const strategyIds = new Set(MULTIPLICATION_G5_STRATEGIES.map((s) => s.strategyId));
    expect(MULTIPLICATION_G5_MISCONCEPTIONS.length).toBeGreaterThanOrEqual(1);
    for (const mc of MULTIPLICATION_G5_MISCONCEPTIONS) {
      expect(mc.skillId).toBe('SK-NS-mult-2x2');
      for (const sid of mc.remediationStrategyIds) expect(strategyIds.has(sid)).toBe(true);
    }
  });

  it('is a Number multiplication graph', () => {
    expect(MULTIPLICATION_G5_SKILLS.every((s) => s.domain === 'math')).toBe(true);
    expect(MULTIPLICATION_G5_SKILLS.every((s) => s.competency === 'number:multiplication')).toBe(
      true,
    );
  });
});
