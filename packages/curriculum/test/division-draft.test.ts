import { describe, it, expect } from 'vitest';
import {
  buildDivisionDraftGraph,
  DIVISION_SKILLS,
  DIVISION_MISCONCEPTIONS,
  DIVISION_STRATEGIES,
} from '@potenova/curriculum';

describe('DRAFT division-facts strand (G3 B2.3)', () => {
  const g = buildDivisionDraftGraph();

  it('is a single-skill acyclic graph', () => {
    expect(g.hasCycle()).toBe(false);
    expect(g.skillCount()).toBe(DIVISION_SKILLS.length);
    expect(DIVISION_SKILLS.map((s) => s.skillId)).toEqual(['SK-NS-div-facts']);
  });

  it('seeds a subtracts-instead-of-divides misconception tied to the skill, with a strategy', () => {
    const strategyIds = new Set(DIVISION_STRATEGIES.map((s) => s.strategyId));
    expect(DIVISION_MISCONCEPTIONS.length).toBeGreaterThanOrEqual(1);
    for (const mc of DIVISION_MISCONCEPTIONS) {
      expect(mc.skillId).toBe('SK-NS-div-facts');
      for (const sid of mc.remediationStrategyIds) expect(strategyIds.has(sid)).toBe(true);
    }
  });

  it('is a Number division graph', () => {
    expect(DIVISION_SKILLS.every((s) => s.domain === 'math')).toBe(true);
    expect(DIVISION_SKILLS.every((s) => s.competency === 'number:division')).toBe(true);
  });
});
