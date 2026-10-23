import { describe, it, expect } from 'vitest';
import {
  buildEstimationDraftGraph,
  ESTIMATION_SKILLS,
  ESTIMATION_MISCONCEPTIONS,
  ESTIMATION_STRATEGIES,
} from '@potenova/curriculum';

describe('DRAFT estimation strand (G1 B1.4)', () => {
  const g = buildEstimationDraftGraph();

  it('is a single-skill acyclic graph', () => {
    expect(g.hasCycle()).toBe(false);
    expect(g.skillCount()).toBe(ESTIMATION_SKILLS.length);
    expect(ESTIMATION_SKILLS.map((s) => s.skillId)).toEqual(['SK-NS-estimate-50']);
  });

  it('seeds a misconception KB tied to the skill, with a remediation strategy', () => {
    const strategyIds = new Set(ESTIMATION_STRATEGIES.map((s) => s.strategyId));
    expect(ESTIMATION_MISCONCEPTIONS.length).toBeGreaterThanOrEqual(1);
    for (const m of ESTIMATION_MISCONCEPTIONS) {
      expect(m.skillId).toBe('SK-NS-estimate-50');
      for (const sid of m.remediationStrategyIds) expect(strategyIds.has(sid)).toBe(true);
    }
  });

  it('is a Number competency graph (number:estimation)', () => {
    expect(ESTIMATION_SKILLS.every((s) => s.domain === 'math')).toBe(true);
    expect(ESTIMATION_SKILLS.every((s) => s.competency === 'number:estimation')).toBe(true);
  });
});
