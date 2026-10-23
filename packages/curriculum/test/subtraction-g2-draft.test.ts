import { describe, it, expect } from 'vitest';
import {
  buildSubtractionG2DraftGraph,
  SUBTRACTION_G2_SKILLS,
  SUBTRACTION_G2_MISCONCEPTIONS,
  SUBTRACTION_G2_STRATEGIES,
} from '@potenova/curriculum';

describe('DRAFT Grade 2 subtraction strand (G2 B2.3 — subtract to 100)', () => {
  const g = buildSubtractionG2DraftGraph();

  it('is a single-skill acyclic graph', () => {
    expect(g.hasCycle()).toBe(false);
    expect(g.skillCount()).toBe(SUBTRACTION_G2_SKILLS.length);
    expect(SUBTRACTION_G2_SKILLS.map((s) => s.skillId)).toEqual(['SK-NS-sub-within100']);
  });

  it('seeds a misconception KB tied to the skill, with a remediation strategy', () => {
    const strategyIds = new Set(SUBTRACTION_G2_STRATEGIES.map((s) => s.strategyId));
    expect(SUBTRACTION_G2_MISCONCEPTIONS.length).toBeGreaterThanOrEqual(1);
    for (const m of SUBTRACTION_G2_MISCONCEPTIONS) {
      expect(m.skillId).toBe('SK-NS-sub-within100');
      for (const sid of m.remediationStrategyIds) expect(strategyIds.has(sid)).toBe(true);
    }
  });

  it('is a Number competency graph (number:subtraction)', () => {
    expect(SUBTRACTION_G2_SKILLS.every((s) => s.domain === 'math')).toBe(true);
    expect(SUBTRACTION_G2_SKILLS.every((s) => s.competency === 'number:subtraction')).toBe(true);
  });
});
