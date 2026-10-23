import { describe, it, expect } from 'vitest';
import {
  buildPlaceValueG2DraftGraph,
  PLACE_VALUE_G2_SKILLS,
  PLACE_VALUE_G2_MISCONCEPTIONS,
  PLACE_VALUE_G2_STRATEGIES,
} from '@potenova/curriculum';

describe('DRAFT place-value-to-200 strand (G2 B1.2)', () => {
  const g = buildPlaceValueG2DraftGraph();

  it('is a single-skill acyclic graph', () => {
    expect(g.hasCycle()).toBe(false);
    expect(g.skillCount()).toBe(PLACE_VALUE_G2_SKILLS.length);
    expect(PLACE_VALUE_G2_SKILLS.map((s) => s.skillId)).toEqual(['SK-NS-compose-200']);
  });

  it('seeds an add-the-counts misconception tied to the skill, with a remediation strategy', () => {
    const strategyIds = new Set(PLACE_VALUE_G2_STRATEGIES.map((s) => s.strategyId));
    expect(PLACE_VALUE_G2_MISCONCEPTIONS.length).toBeGreaterThanOrEqual(1);
    for (const m of PLACE_VALUE_G2_MISCONCEPTIONS) {
      expect(m.skillId).toBe('SK-NS-compose-200');
      for (const sid of m.remediationStrategyIds) expect(strategyIds.has(sid)).toBe(true);
    }
  });

  it('is a Number place-value graph', () => {
    expect(PLACE_VALUE_G2_SKILLS.every((s) => s.domain === 'math')).toBe(true);
    expect(PLACE_VALUE_G2_SKILLS.every((s) => s.competency === 'number:place-value')).toBe(true);
  });
});
