import { describe, it, expect } from 'vitest';
import {
  buildIntegersMulDivG8DraftGraph,
  INTEGERS_MULDIV_G8_SKILLS,
  INTEGERS_MULDIV_G8_MISCONCEPTIONS,
  INTEGERS_MULDIV_G8_STRATEGIES,
} from '@potenova/curriculum';

describe('DRAFT integer multiply/divide strand (G8 B2.7)', () => {
  const g = buildIntegersMulDivG8DraftGraph();

  it('is a single-skill acyclic graph', () => {
    expect(g.hasCycle()).toBe(false);
    expect(g.skillCount()).toBe(INTEGERS_MULDIV_G8_SKILLS.length);
    expect(INTEGERS_MULDIV_G8_SKILLS.map((s) => s.skillId)).toEqual([
      'SK-NS-integer-muldiv-signed',
    ]);
  });

  it('seeds the sign-rule misconception tied to the skill, with a strategy', () => {
    const strategyIds = new Set(INTEGERS_MULDIV_G8_STRATEGIES.map((s) => s.strategyId));
    expect(INTEGERS_MULDIV_G8_MISCONCEPTIONS.length).toBeGreaterThanOrEqual(1);
    for (const mc of INTEGERS_MULDIV_G8_MISCONCEPTIONS) {
      expect(mc.skillId).toBe('SK-NS-integer-muldiv-signed');
      for (const sid of mc.remediationStrategyIds) expect(strategyIds.has(sid)).toBe(true);
    }
  });

  it('is a Number integers graph', () => {
    expect(INTEGERS_MULDIV_G8_SKILLS.every((s) => s.domain === 'math')).toBe(true);
    expect(INTEGERS_MULDIV_G8_SKILLS.every((s) => s.competency === 'number:integers')).toBe(true);
  });
});
