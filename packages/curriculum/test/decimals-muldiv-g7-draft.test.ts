import { describe, it, expect } from 'vitest';
import {
  buildDecimalsMulDivG7DraftGraph,
  DECIMALS_MULDIV_G7_SKILLS,
  DECIMALS_MULDIV_G7_MISCONCEPTIONS,
  DECIMALS_MULDIV_G7_STRATEGIES,
} from '@potenova/curriculum';

describe('DRAFT decimal multiply/divide strand (G7 B2.9)', () => {
  const g = buildDecimalsMulDivG7DraftGraph();

  it('is a single-skill acyclic graph', () => {
    expect(g.hasCycle()).toBe(false);
    expect(g.skillCount()).toBe(DECIMALS_MULDIV_G7_SKILLS.length);
    expect(DECIMALS_MULDIV_G7_SKILLS.map((s) => s.skillId)).toEqual(['SK-NS-decimal-muldiv']);
  });

  it('seeds the misplaced-decimal-point misconception tied to the skill, with a strategy', () => {
    const strategyIds = new Set(DECIMALS_MULDIV_G7_STRATEGIES.map((s) => s.strategyId));
    expect(DECIMALS_MULDIV_G7_MISCONCEPTIONS.length).toBeGreaterThanOrEqual(1);
    for (const mc of DECIMALS_MULDIV_G7_MISCONCEPTIONS) {
      expect(mc.skillId).toBe('SK-NS-decimal-muldiv');
      for (const sid of mc.remediationStrategyIds) expect(strategyIds.has(sid)).toBe(true);
    }
  });

  it('is a Number decimals graph', () => {
    expect(DECIMALS_MULDIV_G7_SKILLS.every((s) => s.domain === 'math')).toBe(true);
    expect(DECIMALS_MULDIV_G7_SKILLS.every((s) => s.competency === 'number:decimals')).toBe(true);
  });
});
