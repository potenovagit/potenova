import { describe, it, expect } from 'vitest';
import {
  buildAlgebraEquivG3DraftGraph,
  ALGEBRA_EQUIV_G3_SKILLS,
  ALGEBRA_EQUIV_G3_MISCONCEPTIONS,
  ALGEBRA_EQUIV_G3_STRATEGIES,
} from '@potenova/curriculum';

describe('DRAFT ×/÷ expression-equivalence strand (G3 B2.2)', () => {
  const g = buildAlgebraEquivG3DraftGraph();

  it('is a single-skill acyclic graph', () => {
    expect(g.hasCycle()).toBe(false);
    expect(g.skillCount()).toBe(ALGEBRA_EQUIV_G3_SKILLS.length);
    expect(ALGEBRA_EQUIV_G3_SKILLS.map((s) => s.skillId)).toEqual(['SK-AL-equiv-expr-muldiv']);
  });

  it('seeds an equals-means-answer misconception tied to the skill, with a strategy', () => {
    const strategyIds = new Set(ALGEBRA_EQUIV_G3_STRATEGIES.map((s) => s.strategyId));
    expect(ALGEBRA_EQUIV_G3_MISCONCEPTIONS.length).toBeGreaterThanOrEqual(1);
    for (const mc of ALGEBRA_EQUIV_G3_MISCONCEPTIONS) {
      expect(mc.skillId).toBe('SK-AL-equiv-expr-muldiv');
      for (const sid of mc.remediationStrategyIds) expect(strategyIds.has(sid)).toBe(true);
    }
  });

  it('is an algebra equivalence graph', () => {
    expect(ALGEBRA_EQUIV_G3_SKILLS.every((s) => s.domain === 'math')).toBe(true);
    expect(ALGEBRA_EQUIV_G3_SKILLS.every((s) => s.competency === 'algebra:equivalence')).toBe(true);
  });
});
