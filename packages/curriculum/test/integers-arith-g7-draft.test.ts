import { describe, it, expect } from 'vitest';
import {
  buildIntegersArithG7DraftGraph,
  INTEGERS_ARITH_G7_SKILLS,
  INTEGERS_ARITH_G7_MISCONCEPTIONS,
  INTEGERS_ARITH_G7_STRATEGIES,
} from '@potenova/curriculum';

describe('DRAFT integer add/subtract strand (G7 B2.4)', () => {
  const g = buildIntegersArithG7DraftGraph();

  it('is a single-skill acyclic graph', () => {
    expect(g.hasCycle()).toBe(false);
    expect(g.skillCount()).toBe(INTEGERS_ARITH_G7_SKILLS.length);
    expect(INTEGERS_ARITH_G7_SKILLS.map((s) => s.skillId)).toEqual(['SK-NS-integer-addsub-signed']);
  });

  it('seeds the subtract-a-negative misconception tied to the skill, with a strategy', () => {
    const strategyIds = new Set(INTEGERS_ARITH_G7_STRATEGIES.map((s) => s.strategyId));
    expect(INTEGERS_ARITH_G7_MISCONCEPTIONS.length).toBeGreaterThanOrEqual(1);
    for (const mc of INTEGERS_ARITH_G7_MISCONCEPTIONS) {
      expect(mc.skillId).toBe('SK-NS-integer-addsub-signed');
      for (const sid of mc.remediationStrategyIds) expect(strategyIds.has(sid)).toBe(true);
    }
  });

  it('is a Number integers graph', () => {
    expect(INTEGERS_ARITH_G7_SKILLS.every((s) => s.domain === 'math')).toBe(true);
    expect(INTEGERS_ARITH_G7_SKILLS.every((s) => s.competency === 'number:integers')).toBe(true);
  });
});
