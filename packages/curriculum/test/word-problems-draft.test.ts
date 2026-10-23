import { describe, it, expect } from 'vitest';
import {
  buildWordProblemsDraftGraph,
  WORD_PROBLEM_SKILLS,
  WORD_PROBLEM_MISCONCEPTIONS,
  WORD_PROBLEM_STRATEGIES,
} from '@potenova/curriculum';

describe('DRAFT word-problems strand (G1 B2.4/B2.5)', () => {
  const g = buildWordProblemsDraftGraph();

  it('is a single-skill acyclic graph', () => {
    expect(g.hasCycle()).toBe(false);
    expect(g.skillCount()).toBe(WORD_PROBLEM_SKILLS.length);
    expect(WORD_PROBLEM_SKILLS.map((s) => s.skillId)).toEqual(['SK-NS-word-problem-addsub']);
  });

  it('seeds a misconception KB tied to the skill, with a remediation strategy', () => {
    const strategyIds = new Set(WORD_PROBLEM_STRATEGIES.map((s) => s.strategyId));
    expect(WORD_PROBLEM_MISCONCEPTIONS.length).toBeGreaterThanOrEqual(1);
    for (const m of WORD_PROBLEM_MISCONCEPTIONS) {
      expect(m.skillId).toBe('SK-NS-word-problem-addsub');
      for (const sid of m.remediationStrategyIds) expect(strategyIds.has(sid)).toBe(true);
    }
  });

  it('is a Number competency graph (number:word-problem)', () => {
    expect(WORD_PROBLEM_SKILLS.every((s) => s.domain === 'math')).toBe(true);
    expect(WORD_PROBLEM_SKILLS.every((s) => s.competency === 'number:word-problem')).toBe(true);
  });
});
