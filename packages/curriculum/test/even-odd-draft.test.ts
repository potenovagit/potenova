import { describe, it, expect } from 'vitest';
import {
  buildEvenOddDraftGraph,
  EVEN_ODD_SKILLS,
  EVEN_ODD_MISCONCEPTIONS,
  EVEN_ODD_STRATEGIES,
} from '@potenova/curriculum';

describe('DRAFT even/odd strand (G2 B1.5)', () => {
  const g = buildEvenOddDraftGraph();

  it('is a single-skill acyclic graph', () => {
    expect(g.hasCycle()).toBe(false);
    expect(g.skillCount()).toBe(EVEN_ODD_SKILLS.length);
    expect(EVEN_ODD_SKILLS.map((s) => s.skillId)).toEqual(['SK-NS-even-odd']);
  });

  it('seeds a misconception KB tied to the skill, with a remediation strategy', () => {
    const strategyIds = new Set(EVEN_ODD_STRATEGIES.map((s) => s.strategyId));
    expect(EVEN_ODD_MISCONCEPTIONS.length).toBeGreaterThanOrEqual(1);
    for (const m of EVEN_ODD_MISCONCEPTIONS) {
      expect(m.skillId).toBe('SK-NS-even-odd');
      for (const sid of m.remediationStrategyIds) expect(strategyIds.has(sid)).toBe(true);
    }
  });

  it('is a Number competency graph (number:parity)', () => {
    expect(EVEN_ODD_SKILLS.every((s) => s.domain === 'math')).toBe(true);
    expect(EVEN_ODD_SKILLS.every((s) => s.competency === 'number:parity')).toBe(true);
  });
});
