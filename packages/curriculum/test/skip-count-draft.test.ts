import { describe, it, expect } from 'vitest';
import {
  buildSkipCountDraftGraph,
  SKIP_COUNT_SKILLS,
  SKIP_COUNT_MISCONCEPTIONS,
  SKIP_COUNT_STRATEGIES,
} from '@potenova/curriculum';

describe('DRAFT skip-counting strand (G1 B1.5)', () => {
  const g = buildSkipCountDraftGraph();

  it('is a single-skill acyclic graph with no prerequisites', () => {
    expect(g.hasCycle()).toBe(false);
    expect(g.skillCount()).toBe(SKIP_COUNT_SKILLS.length);
    expect(SKIP_COUNT_SKILLS.map((s) => s.skillId)).toEqual(['SK-NS-skip-count-50']);
    expect(g.directPrerequisites('SK-NS-skip-count-50')).toEqual([]);
  });

  it('seeds a misconception KB tied to the skill, with a remediation strategy', () => {
    const strategyIds = new Set(SKIP_COUNT_STRATEGIES.map((s) => s.strategyId));
    expect(SKIP_COUNT_MISCONCEPTIONS.length).toBeGreaterThanOrEqual(1);
    for (const m of SKIP_COUNT_MISCONCEPTIONS) {
      expect(m.skillId).toBe('SK-NS-skip-count-50');
      for (const sid of m.remediationStrategyIds) expect(strategyIds.has(sid)).toBe(true);
    }
  });

  it('is a distinct Math competency graph (number:skip-counting)', () => {
    expect(SKIP_COUNT_SKILLS.every((s) => s.domain === 'math')).toBe(true);
    expect(SKIP_COUNT_SKILLS.every((s) => s.competency === 'number:skip-counting')).toBe(true);
  });
});
