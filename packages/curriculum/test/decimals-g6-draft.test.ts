import { describe, it, expect } from 'vitest';
import {
  buildDecimalsG6DraftGraph,
  DECIMALS_G6_SKILLS,
  DECIMALS_G6_MISCONCEPTIONS,
  DECIMALS_G6_STRATEGIES,
} from '@potenova/curriculum';

describe('DRAFT decimals-to-thousandths strand (G6 exp 3/4)', () => {
  const g = buildDecimalsG6DraftGraph();

  it('is a two-skill acyclic graph', () => {
    expect(g.hasCycle()).toBe(false);
    expect(g.skillCount()).toBe(DECIMALS_G6_SKILLS.length);
    expect(DECIMALS_G6_SKILLS.map((s) => s.skillId).sort()).toEqual([
      'SK-NS-decimal-round-hundredth',
      'SK-NS-decimal-thousandth-compare',
    ]);
  });

  it('seeds at least one misconception per skill, each with a known strategy', () => {
    const strategyIds = new Set(DECIMALS_G6_STRATEGIES.map((s) => s.strategyId));
    const skillIds = new Set(DECIMALS_G6_SKILLS.map((s) => s.skillId));
    expect(DECIMALS_G6_MISCONCEPTIONS.length).toBeGreaterThanOrEqual(2);
    for (const mc of DECIMALS_G6_MISCONCEPTIONS) {
      expect(skillIds.has(mc.skillId)).toBe(true);
      for (const sid of mc.remediationStrategyIds) expect(strategyIds.has(sid)).toBe(true);
    }
    for (const sid of skillIds) {
      expect(DECIMALS_G6_MISCONCEPTIONS.some((mc) => mc.skillId === sid)).toBe(true);
    }
  });

  it('is a Number decimals graph', () => {
    expect(DECIMALS_G6_SKILLS.every((s) => s.domain === 'math')).toBe(true);
    expect(DECIMALS_G6_SKILLS.every((s) => s.competency === 'number:decimals')).toBe(true);
  });
});
