import { describe, it, expect } from 'vitest';
import {
  buildRoundingDraftGraph,
  ROUNDING_SKILLS,
  ROUNDING_MISCONCEPTIONS,
  ROUNDING_STRATEGIES,
} from '@potenova/curriculum';

describe('DRAFT rounding strand (G4 exp 2)', () => {
  const g = buildRoundingDraftGraph();

  it('is a single-skill acyclic graph', () => {
    expect(g.hasCycle()).toBe(false);
    expect(g.skillCount()).toBe(ROUNDING_SKILLS.length);
    expect(ROUNDING_SKILLS.map((s) => s.skillId)).toEqual(['SK-NS-round-whole']);
  });

  it('seeds a truncate-not-round misconception tied to the skill, with a strategy', () => {
    const strategyIds = new Set(ROUNDING_STRATEGIES.map((s) => s.strategyId));
    expect(ROUNDING_MISCONCEPTIONS.length).toBeGreaterThanOrEqual(1);
    for (const mc of ROUNDING_MISCONCEPTIONS) {
      expect(mc.skillId).toBe('SK-NS-round-whole');
      for (const sid of mc.remediationStrategyIds) expect(strategyIds.has(sid)).toBe(true);
    }
  });

  it('is a Number rounding graph', () => {
    expect(ROUNDING_SKILLS.every((s) => s.domain === 'math')).toBe(true);
    expect(ROUNDING_SKILLS.every((s) => s.competency === 'number:rounding')).toBe(true);
  });
});
