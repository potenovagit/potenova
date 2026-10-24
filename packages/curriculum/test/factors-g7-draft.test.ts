import { describe, it, expect } from 'vitest';
import {
  buildFactorsG7DraftGraph,
  FACTORS_G7_SKILLS,
  FACTORS_G7_MISCONCEPTIONS,
  FACTORS_G7_STRATEGIES,
} from '@potenova/curriculum';

describe('DRAFT GCF/LCM strand (G7 B2.6)', () => {
  const g = buildFactorsG7DraftGraph();

  it('is a two-skill acyclic graph', () => {
    expect(g.hasCycle()).toBe(false);
    expect(g.skillCount()).toBe(FACTORS_G7_SKILLS.length);
    expect(FACTORS_G7_SKILLS.map((s) => s.skillId).sort()).toEqual([
      'SK-NS-gcf-pair',
      'SK-NS-lcm-pair',
    ]);
  });

  it('seeds at least one misconception per skill, each with a known strategy', () => {
    const strategyIds = new Set(FACTORS_G7_STRATEGIES.map((s) => s.strategyId));
    const skillIds = new Set(FACTORS_G7_SKILLS.map((s) => s.skillId));
    expect(FACTORS_G7_MISCONCEPTIONS.length).toBeGreaterThanOrEqual(2);
    for (const mc of FACTORS_G7_MISCONCEPTIONS) {
      expect(skillIds.has(mc.skillId)).toBe(true);
      for (const sid of mc.remediationStrategyIds) expect(strategyIds.has(sid)).toBe(true);
    }
    for (const sid of skillIds) {
      expect(FACTORS_G7_MISCONCEPTIONS.some((mc) => mc.skillId === sid)).toBe(true);
    }
  });

  it('is a Number factors graph', () => {
    expect(FACTORS_G7_SKILLS.every((s) => s.domain === 'math')).toBe(true);
    expect(FACTORS_G7_SKILLS.every((s) => s.competency === 'number:factors')).toBe(true);
  });
});
