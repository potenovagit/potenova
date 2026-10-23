import { describe, it, expect } from 'vitest';
import {
  buildMultiplicationG4DraftGraph,
  MULTIPLICATION_G4_SKILLS,
  MULTIPLICATION_G4_MISCONCEPTIONS,
  MULTIPLICATION_G4_STRATEGIES,
} from '@potenova/curriculum';

describe('DRAFT multi-digit multiplication strand (G4 exp 13)', () => {
  const g = buildMultiplicationG4DraftGraph();

  it('is a single-skill acyclic graph', () => {
    expect(g.hasCycle()).toBe(false);
    expect(g.skillCount()).toBe(MULTIPLICATION_G4_SKILLS.length);
    expect(MULTIPLICATION_G4_SKILLS.map((s) => s.skillId)).toEqual(['SK-NS-mult-multidigit']);
  });

  it('seeds a multiplies-ones-only misconception tied to the skill, with a strategy', () => {
    const strategyIds = new Set(MULTIPLICATION_G4_STRATEGIES.map((s) => s.strategyId));
    expect(MULTIPLICATION_G4_MISCONCEPTIONS.length).toBeGreaterThanOrEqual(1);
    for (const mc of MULTIPLICATION_G4_MISCONCEPTIONS) {
      expect(mc.skillId).toBe('SK-NS-mult-multidigit');
      for (const sid of mc.remediationStrategyIds) expect(strategyIds.has(sid)).toBe(true);
    }
  });

  it('is a Number multiplication graph', () => {
    expect(MULTIPLICATION_G4_SKILLS.every((s) => s.domain === 'math')).toBe(true);
    expect(MULTIPLICATION_G4_SKILLS.every((s) => s.competency === 'number:multiplication')).toBe(
      true,
    );
  });
});
