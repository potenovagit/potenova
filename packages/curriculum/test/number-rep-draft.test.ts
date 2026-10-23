import { describe, it, expect } from 'vitest';
import {
  buildNumberRepDraftGraph,
  NUMBER_REP_SKILLS,
  NUMBER_REP_MISCONCEPTIONS,
  NUMBER_REP_STRATEGIES,
} from '@potenova/curriculum';

describe('DRAFT number-representation strand (G1 B1.1 — selection interaction)', () => {
  const g = buildNumberRepDraftGraph();

  it('is a single-skill acyclic graph', () => {
    expect(g.hasCycle()).toBe(false);
    expect(g.skillCount()).toBe(NUMBER_REP_SKILLS.length);
    expect(NUMBER_REP_SKILLS.map((s) => s.skillId)).toEqual(['SK-NS-represent-50']);
  });

  it('seeds a misconception KB tied to the skill, with a remediation strategy', () => {
    const strategyIds = new Set(NUMBER_REP_STRATEGIES.map((s) => s.strategyId));
    expect(NUMBER_REP_MISCONCEPTIONS.length).toBeGreaterThanOrEqual(1);
    for (const m of NUMBER_REP_MISCONCEPTIONS) {
      expect(m.skillId).toBe('SK-NS-represent-50');
      for (const sid of m.remediationStrategyIds) expect(strategyIds.has(sid)).toBe(true);
    }
  });

  it('is a Number competency graph (number:representation)', () => {
    expect(NUMBER_REP_SKILLS.every((s) => s.domain === 'math')).toBe(true);
    expect(NUMBER_REP_SKILLS.every((s) => s.competency === 'number:representation')).toBe(true);
  });
});
