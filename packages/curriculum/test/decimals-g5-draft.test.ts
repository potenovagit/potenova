import { describe, it, expect } from 'vitest';
import {
  buildDecimalsG5DraftGraph,
  DECIMALS_G5_SKILLS,
  DECIMALS_G5_MISCONCEPTIONS,
  DECIMALS_G5_STRATEGIES,
} from '@potenova/curriculum';

describe('DRAFT decimals-to-hundredths strand (G5 exp 4/5)', () => {
  const g = buildDecimalsG5DraftGraph();

  it('is a two-skill acyclic graph', () => {
    expect(g.hasCycle()).toBe(false);
    expect(g.skillCount()).toBe(DECIMALS_G5_SKILLS.length);
    expect(DECIMALS_G5_SKILLS.map((s) => s.skillId)).toEqual([
      'SK-NS-decimal-hundredth-compare',
      'SK-NS-decimal-round-tenth',
    ]);
  });

  it('seeds a misconception for each skill, each with a known remediation strategy', () => {
    const strategyIds = new Set(DECIMALS_G5_STRATEGIES.map((s) => s.strategyId));
    const skillIds = new Set(DECIMALS_G5_SKILLS.map((s) => s.skillId));
    expect(DECIMALS_G5_MISCONCEPTIONS.length).toBeGreaterThanOrEqual(2);
    for (const mc of DECIMALS_G5_MISCONCEPTIONS) {
      expect(skillIds.has(mc.skillId)).toBe(true);
      for (const sid of mc.remediationStrategyIds) expect(strategyIds.has(sid)).toBe(true);
    }
  });

  it('is a Number decimals graph', () => {
    expect(DECIMALS_G5_SKILLS.every((s) => s.domain === 'math')).toBe(true);
    expect(DECIMALS_G5_SKILLS.every((s) => s.competency === 'number:decimals')).toBe(true);
  });
});
