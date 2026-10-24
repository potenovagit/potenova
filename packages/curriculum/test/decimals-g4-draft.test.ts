import { describe, it, expect } from 'vitest';
import {
  buildDecimalsG4DraftGraph,
  DECIMALS_G4_SKILLS,
  DECIMALS_G4_MISCONCEPTIONS,
  DECIMALS_G4_STRATEGIES,
} from '@potenova/curriculum';

describe('DRAFT decimal-tenths strand (G4 exp 6/7/8)', () => {
  const g = buildDecimalsG4DraftGraph();

  it('is a three-skill acyclic graph', () => {
    expect(g.hasCycle()).toBe(false);
    expect(g.skillCount()).toBe(DECIMALS_G4_SKILLS.length);
    expect(DECIMALS_G4_SKILLS.map((s) => s.skillId)).toEqual([
      'SK-NS-decimal-compare',
      'SK-NS-decimal-round',
      'SK-NS-fraction-decimal-equiv',
    ]);
  });

  it('seeds a misconception for each skill, each with a known remediation strategy', () => {
    const strategyIds = new Set(DECIMALS_G4_STRATEGIES.map((s) => s.strategyId));
    const skillIds = new Set(DECIMALS_G4_SKILLS.map((s) => s.skillId));
    expect(DECIMALS_G4_MISCONCEPTIONS.length).toBeGreaterThanOrEqual(3);
    for (const mc of DECIMALS_G4_MISCONCEPTIONS) {
      expect(skillIds.has(mc.skillId)).toBe(true);
      for (const sid of mc.remediationStrategyIds) expect(strategyIds.has(sid)).toBe(true);
    }
  });

  it('is a Number decimals graph', () => {
    expect(DECIMALS_G4_SKILLS.every((s) => s.domain === 'math')).toBe(true);
    expect(DECIMALS_G4_SKILLS.every((s) => s.competency === 'number:decimals')).toBe(true);
  });
});
