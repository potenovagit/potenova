import { describe, it, expect } from 'vitest';
import {
  buildWordProblemsG2DraftGraph,
  WORD_PROBLEMS_G2_SKILLS,
  WORD_PROBLEMS_G2_MISCONCEPTIONS,
  WORD_PROBLEMS_G2_STRATEGIES,
} from '@potenova/curriculum';

describe('DRAFT word-problems-to-100 strand (G2 B2.4/B2.5)', () => {
  const g = buildWordProblemsG2DraftGraph();

  it('is a single-skill acyclic graph', () => {
    expect(g.hasCycle()).toBe(false);
    expect(g.skillCount()).toBe(WORD_PROBLEMS_G2_SKILLS.length);
    expect(WORD_PROBLEMS_G2_SKILLS.map((s) => s.skillId)).toEqual([
      'SK-NS-word-problem-addsub-100',
    ]);
  });

  it('seeds a wrong-operation misconception tied to the skill, with a remediation strategy', () => {
    const strategyIds = new Set(WORD_PROBLEMS_G2_STRATEGIES.map((s) => s.strategyId));
    expect(WORD_PROBLEMS_G2_MISCONCEPTIONS.length).toBeGreaterThanOrEqual(1);
    for (const m of WORD_PROBLEMS_G2_MISCONCEPTIONS) {
      expect(m.skillId).toBe('SK-NS-word-problem-addsub-100');
      for (const sid of m.remediationStrategyIds) expect(strategyIds.has(sid)).toBe(true);
    }
  });

  it('is a Number word-problem graph', () => {
    expect(WORD_PROBLEMS_G2_SKILLS.every((s) => s.domain === 'math')).toBe(true);
    expect(WORD_PROBLEMS_G2_SKILLS.every((s) => s.competency === 'number:word-problem')).toBe(true);
  });
});
