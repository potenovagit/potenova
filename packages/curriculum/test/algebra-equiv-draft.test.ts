import { describe, it, expect } from 'vitest';
import {
  buildAlgebraEquivDraftGraph,
  ALGEBRA_EQUIV_SKILLS,
  ALGEBRA_EQUIV_MISCONCEPTIONS,
  ALGEBRA_EQUIV_STRATEGIES,
} from '@potenova/curriculum';

describe('DRAFT algebra expression-equivalence strand (G1 C2.2 — first Algebra skill)', () => {
  const g = buildAlgebraEquivDraftGraph();

  it('is a single-skill acyclic graph', () => {
    expect(g.hasCycle()).toBe(false);
    expect(g.skillCount()).toBe(ALGEBRA_EQUIV_SKILLS.length);
    expect(ALGEBRA_EQUIV_SKILLS.map((s) => s.skillId)).toEqual(['SK-AL-equiv-expr']);
  });

  it('seeds a misconception KB tied to the skill, with a remediation strategy', () => {
    const strategyIds = new Set(ALGEBRA_EQUIV_STRATEGIES.map((s) => s.strategyId));
    expect(ALGEBRA_EQUIV_MISCONCEPTIONS.length).toBeGreaterThanOrEqual(1);
    for (const m of ALGEBRA_EQUIV_MISCONCEPTIONS) {
      expect(m.skillId).toBe('SK-AL-equiv-expr');
      for (const sid of m.remediationStrategyIds) expect(strategyIds.has(sid)).toBe(true);
    }
  });

  it('is an Algebra competency graph (algebra:equivalence), distinct from Number', () => {
    expect(ALGEBRA_EQUIV_SKILLS.every((s) => s.domain === 'math')).toBe(true);
    expect(ALGEBRA_EQUIV_SKILLS.every((s) => s.competency === 'algebra:equivalence')).toBe(true);
  });
});
