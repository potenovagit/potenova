import { describe, it, expect } from 'vitest';
import {
  buildPowersOfTenG8DraftGraph,
  POWERS_OF_TEN_G8_SKILLS,
  POWERS_OF_TEN_G8_MISCONCEPTIONS,
  POWERS_OF_TEN_G8_STRATEGIES,
} from '@potenova/curriculum';

describe('DRAFT powers-of-ten strand (G8 B2.3)', () => {
  const g = buildPowersOfTenG8DraftGraph();

  it('is a single-skill acyclic graph', () => {
    expect(g.hasCycle()).toBe(false);
    expect(g.skillCount()).toBe(POWERS_OF_TEN_G8_SKILLS.length);
    expect(POWERS_OF_TEN_G8_SKILLS.map((s) => s.skillId)).toEqual(['SK-NS-power-of-ten-scale']);
  });

  it('seeds the decimal-shift misconception tied to the skill, with a strategy', () => {
    const strategyIds = new Set(POWERS_OF_TEN_G8_STRATEGIES.map((s) => s.strategyId));
    expect(POWERS_OF_TEN_G8_MISCONCEPTIONS.length).toBeGreaterThanOrEqual(1);
    for (const mc of POWERS_OF_TEN_G8_MISCONCEPTIONS) {
      expect(mc.skillId).toBe('SK-NS-power-of-ten-scale');
      for (const sid of mc.remediationStrategyIds) expect(strategyIds.has(sid)).toBe(true);
    }
  });

  it('is a Number decimals graph', () => {
    expect(POWERS_OF_TEN_G8_SKILLS.every((s) => s.domain === 'math')).toBe(true);
    expect(POWERS_OF_TEN_G8_SKILLS.every((s) => s.competency === 'number:decimals')).toBe(true);
  });
});
