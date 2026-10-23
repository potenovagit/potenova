import { describe, it, expect } from 'vitest';
import {
  buildAddSubtractG4DraftGraph,
  ADD_SUBTRACT_G4_SKILLS,
  ADD_SUBTRACT_G4_MISCONCEPTIONS,
  ADD_SUBTRACT_G4_STRATEGIES,
} from '@potenova/curriculum';

describe('DRAFT add/subtract-to-10000 strand (G4 exp 12)', () => {
  const g = buildAddSubtractG4DraftGraph();

  it('is a two-skill acyclic graph (add before subtract)', () => {
    expect(g.hasCycle()).toBe(false);
    expect(g.skillCount()).toBe(ADD_SUBTRACT_G4_SKILLS.length);
    expect(ADD_SUBTRACT_G4_SKILLS.map((s) => s.skillId)).toEqual([
      'SK-NS-add-within10000',
      'SK-NS-sub-within10000',
    ]);
  });

  it('seeds a regroup-across-zeros misconception tied to the subtraction skill, with a strategy', () => {
    const strategyIds = new Set(ADD_SUBTRACT_G4_STRATEGIES.map((s) => s.strategyId));
    expect(ADD_SUBTRACT_G4_MISCONCEPTIONS.length).toBeGreaterThanOrEqual(1);
    for (const mc of ADD_SUBTRACT_G4_MISCONCEPTIONS) {
      expect(mc.skillId).toBe('SK-NS-sub-within10000');
      for (const sid of mc.remediationStrategyIds) expect(strategyIds.has(sid)).toBe(true);
    }
  });

  it('is a Number add/subtract graph', () => {
    expect(ADD_SUBTRACT_G4_SKILLS.every((s) => s.domain === 'math')).toBe(true);
    const comps = new Set(ADD_SUBTRACT_G4_SKILLS.map((s) => s.competency));
    expect(comps.has('number:addition')).toBe(true);
    expect(comps.has('number:subtraction')).toBe(true);
  });
});
