import { describe, it, expect } from 'vitest';
import {
  buildWholeNumberG2DraftGraph,
  WHOLE_NUMBER_G2_SKILLS,
  WHOLE_NUMBER_G2_DEPENDENCIES,
  WHOLE_NUMBER_G2_MISCONCEPTIONS,
  WHOLE_NUMBER_G2_STRATEGIES,
} from '@potenova/curriculum';

describe('DRAFT Grade 2 whole-number strand (G2 B1.2 — compare/order to 200)', () => {
  const g = buildWholeNumberG2DraftGraph();

  it('is acyclic and keeps the compare → order prerequisite chain', () => {
    expect(g.hasCycle()).toBe(false);
    expect(g.skillCount()).toBe(WHOLE_NUMBER_G2_SKILLS.length);
    expect(g.directPrerequisites('SK-NS-order-whole-200')).toEqual(['SK-NS-compare-whole-200']);
    expect(g.directPrerequisites('SK-NS-compare-whole-200')).toEqual([]);
    expect(WHOLE_NUMBER_G2_DEPENDENCIES[0].type).toBe('hardPrerequisite');
  });

  it('seeds a misconception KB tied to real skills, with a remediation strategy', () => {
    const skillIds = new Set(WHOLE_NUMBER_G2_SKILLS.map((s) => s.skillId));
    const strategyIds = new Set(WHOLE_NUMBER_G2_STRATEGIES.map((s) => s.strategyId));
    expect(WHOLE_NUMBER_G2_MISCONCEPTIONS.length).toBeGreaterThanOrEqual(1);
    for (const m of WHOLE_NUMBER_G2_MISCONCEPTIONS) {
      expect(skillIds.has(m.skillId)).toBe(true);
      for (const sid of m.remediationStrategyIds) expect(strategyIds.has(sid)).toBe(true);
    }
  });

  it('is a Number competency graph (number:whole-number)', () => {
    expect(WHOLE_NUMBER_G2_SKILLS.every((s) => s.domain === 'math')).toBe(true);
    expect(WHOLE_NUMBER_G2_SKILLS.every((s) => s.competency === 'number:whole-number')).toBe(true);
  });
});
