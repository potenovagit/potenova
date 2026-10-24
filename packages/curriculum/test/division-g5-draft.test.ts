import { describe, it, expect } from 'vitest';
import {
  buildDivisionG5DraftGraph,
  DIVISION_G5_SKILLS,
  DIVISION_G5_MISCONCEPTIONS,
  DIVISION_G5_STRATEGIES,
} from '@potenova/curriculum';

describe('DRAFT 3-digit ÷ 2-digit division strand (G5 exp 13)', () => {
  const g = buildDivisionG5DraftGraph();

  it('is a single-skill acyclic graph', () => {
    expect(g.hasCycle()).toBe(false);
    expect(g.skillCount()).toBe(DIVISION_G5_SKILLS.length);
    expect(DIVISION_G5_SKILLS.map((s) => s.skillId)).toEqual(['SK-NS-div-2digit']);
  });

  it('seeds a drops-remainder misconception tied to the skill, with a strategy', () => {
    const strategyIds = new Set(DIVISION_G5_STRATEGIES.map((s) => s.strategyId));
    expect(DIVISION_G5_MISCONCEPTIONS.length).toBeGreaterThanOrEqual(1);
    for (const mc of DIVISION_G5_MISCONCEPTIONS) {
      expect(mc.skillId).toBe('SK-NS-div-2digit');
      for (const sid of mc.remediationStrategyIds) expect(strategyIds.has(sid)).toBe(true);
    }
  });

  it('is a Number division graph', () => {
    expect(DIVISION_G5_SKILLS.every((s) => s.domain === 'math')).toBe(true);
    expect(DIVISION_G5_SKILLS.every((s) => s.competency === 'number:division')).toBe(true);
  });
});
