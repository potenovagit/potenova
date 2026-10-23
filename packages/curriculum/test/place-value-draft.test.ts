import { describe, it, expect } from 'vitest';
import {
  buildPlaceValueDraftGraph,
  PLACE_VALUE_SKILLS,
  PLACE_VALUE_MISCONCEPTIONS,
  PLACE_VALUE_STRATEGIES,
} from '@potenova/curriculum';

describe('DRAFT place-value composition strand (G1 B1.2)', () => {
  const g = buildPlaceValueDraftGraph();

  it('is a single-skill acyclic graph', () => {
    expect(g.hasCycle()).toBe(false);
    expect(g.skillCount()).toBe(PLACE_VALUE_SKILLS.length);
    expect(PLACE_VALUE_SKILLS.map((s) => s.skillId)).toEqual(['SK-NS-compose-50']);
  });

  it('seeds a misconception KB tied to the skill, with a remediation strategy', () => {
    const strategyIds = new Set(PLACE_VALUE_STRATEGIES.map((s) => s.strategyId));
    expect(PLACE_VALUE_MISCONCEPTIONS.length).toBeGreaterThanOrEqual(1);
    for (const m of PLACE_VALUE_MISCONCEPTIONS) {
      expect(m.skillId).toBe('SK-NS-compose-50');
      for (const sid of m.remediationStrategyIds) expect(strategyIds.has(sid)).toBe(true);
    }
  });

  it('is a Number competency graph (number:place-value)', () => {
    expect(PLACE_VALUE_SKILLS.every((s) => s.domain === 'math')).toBe(true);
    expect(PLACE_VALUE_SKILLS.every((s) => s.competency === 'number:place-value')).toBe(true);
  });
});
