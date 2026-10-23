import { describe, it, expect } from 'vitest';
import {
  buildCodingDraftGraph,
  CODING_SKILLS,
  CODING_MISCONCEPTIONS,
  CODING_STRATEGIES,
} from '@potenova/curriculum';

describe('DRAFT coding strand (G1 C3.1/C3.2 — sequential programs, selection)', () => {
  const g = buildCodingDraftGraph();

  it('is a single-skill acyclic graph', () => {
    expect(g.hasCycle()).toBe(false);
    expect(g.skillCount()).toBe(CODING_SKILLS.length);
    expect(CODING_SKILLS.map((s) => s.skillId)).toEqual(['SK-AL-code-sequence']);
  });

  it('seeds a misconception KB tied to the skill, with a remediation strategy', () => {
    const strategyIds = new Set(CODING_STRATEGIES.map((s) => s.strategyId));
    expect(CODING_MISCONCEPTIONS.length).toBeGreaterThanOrEqual(1);
    for (const m of CODING_MISCONCEPTIONS) {
      expect(m.skillId).toBe('SK-AL-code-sequence');
      for (const sid of m.remediationStrategyIds) expect(strategyIds.has(sid)).toBe(true);
    }
  });

  it('is an Algebra competency graph (algebra:coding)', () => {
    expect(CODING_SKILLS.every((s) => s.domain === 'math')).toBe(true);
    expect(CODING_SKILLS.every((s) => s.competency === 'algebra:coding')).toBe(true);
  });
});
