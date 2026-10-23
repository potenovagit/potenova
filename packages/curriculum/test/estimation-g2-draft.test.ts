import { describe, it, expect } from 'vitest';
import {
  buildEstimationG2DraftGraph,
  ESTIMATION_G2_SKILLS,
  ESTIMATION_G2_MISCONCEPTIONS,
  ESTIMATION_G2_STRATEGIES,
} from '@potenova/curriculum';

describe('DRAFT estimation-to-200 strand (G2 B1.3)', () => {
  const g = buildEstimationG2DraftGraph();

  it('is a single-skill acyclic graph', () => {
    expect(g.hasCycle()).toBe(false);
    expect(g.skillCount()).toBe(ESTIMATION_G2_SKILLS.length);
    expect(ESTIMATION_G2_SKILLS.map((s) => s.skillId)).toEqual(['SK-NS-estimate-200']);
  });

  it('seeds a wild-guess misconception tied to the skill, with a remediation strategy', () => {
    const strategyIds = new Set(ESTIMATION_G2_STRATEGIES.map((s) => s.strategyId));
    expect(ESTIMATION_G2_MISCONCEPTIONS.length).toBeGreaterThanOrEqual(1);
    for (const m of ESTIMATION_G2_MISCONCEPTIONS) {
      expect(m.skillId).toBe('SK-NS-estimate-200');
      for (const sid of m.remediationStrategyIds) expect(strategyIds.has(sid)).toBe(true);
    }
  });

  it('is a Number estimation graph', () => {
    expect(ESTIMATION_G2_SKILLS.every((s) => s.domain === 'math')).toBe(true);
    expect(ESTIMATION_G2_SKILLS.every((s) => s.competency === 'number:estimation')).toBe(true);
  });
});
