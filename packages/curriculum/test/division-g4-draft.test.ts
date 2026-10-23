import { describe, it, expect } from 'vitest';
import {
  buildDivisionG4DraftGraph,
  DIVISION_G4_SKILLS,
  DIVISION_G4_MISCONCEPTIONS,
  DIVISION_G4_STRATEGIES,
} from '@potenova/curriculum';

describe('DRAFT division-with-remainder strand (G4 exp 14)', () => {
  const g = buildDivisionG4DraftGraph();

  it('is a single-skill acyclic graph', () => {
    expect(g.hasCycle()).toBe(false);
    expect(g.skillCount()).toBe(DIVISION_G4_SKILLS.length);
    expect(DIVISION_G4_SKILLS.map((s) => s.skillId)).toEqual(['SK-NS-div-remainder']);
  });

  it('seeds a drops-remainder misconception tied to the skill, with a strategy', () => {
    const strategyIds = new Set(DIVISION_G4_STRATEGIES.map((s) => s.strategyId));
    expect(DIVISION_G4_MISCONCEPTIONS.length).toBeGreaterThanOrEqual(1);
    for (const mc of DIVISION_G4_MISCONCEPTIONS) {
      expect(mc.skillId).toBe('SK-NS-div-remainder');
      for (const sid of mc.remediationStrategyIds) expect(strategyIds.has(sid)).toBe(true);
    }
  });

  it('is a Number division graph', () => {
    expect(DIVISION_G4_SKILLS.every((s) => s.domain === 'math')).toBe(true);
    expect(DIVISION_G4_SKILLS.every((s) => s.competency === 'number:division')).toBe(true);
  });
});
