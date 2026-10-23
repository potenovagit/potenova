import { describe, it, expect } from 'vitest';
import {
  buildSkipCountG2DraftGraph,
  SKIP_COUNT_G2_SKILLS,
  SKIP_COUNT_G2_MISCONCEPTIONS,
  SKIP_COUNT_G2_STRATEGIES,
} from '@potenova/curriculum';

describe('DRAFT Grade 2 skip-count strand (G2 B1.4 — by 20s/25s/50s to 200)', () => {
  const g = buildSkipCountG2DraftGraph();

  it('is a single-skill acyclic graph', () => {
    expect(g.hasCycle()).toBe(false);
    expect(g.skillCount()).toBe(SKIP_COUNT_G2_SKILLS.length);
    expect(SKIP_COUNT_G2_SKILLS.map((s) => s.skillId)).toEqual(['SK-NS-skip-count-200']);
  });

  it('seeds a misconception KB tied to the skill, with a remediation strategy', () => {
    const strategyIds = new Set(SKIP_COUNT_G2_STRATEGIES.map((s) => s.strategyId));
    expect(SKIP_COUNT_G2_MISCONCEPTIONS.length).toBeGreaterThanOrEqual(1);
    for (const m of SKIP_COUNT_G2_MISCONCEPTIONS) {
      expect(m.skillId).toBe('SK-NS-skip-count-200');
      for (const sid of m.remediationStrategyIds) expect(strategyIds.has(sid)).toBe(true);
    }
  });

  it('is a Number competency graph (number:skip-counting)', () => {
    expect(SKIP_COUNT_G2_SKILLS.every((s) => s.domain === 'math')).toBe(true);
    expect(SKIP_COUNT_G2_SKILLS.every((s) => s.competency === 'number:skip-counting')).toBe(true);
  });
});
