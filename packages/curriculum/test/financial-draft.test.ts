import { describe, it, expect } from 'vitest';
import {
  buildFinancialDraftGraph,
  FINANCIAL_SKILLS,
  FINANCIAL_MISCONCEPTIONS,
  FINANCIAL_STRATEGIES,
} from '@potenova/curriculum';

describe('DRAFT financial-literacy strand (G1 F1.1 — first Financial skill)', () => {
  const g = buildFinancialDraftGraph();

  it('is a single-skill acyclic graph', () => {
    expect(g.hasCycle()).toBe(false);
    expect(g.skillCount()).toBe(FINANCIAL_SKILLS.length);
    expect(FINANCIAL_SKILLS.map((s) => s.skillId)).toEqual(['SK-FIN-coin-value']);
  });

  it('seeds a misconception KB tied to the skill, with a remediation strategy', () => {
    const strategyIds = new Set(FINANCIAL_STRATEGIES.map((s) => s.strategyId));
    expect(FINANCIAL_MISCONCEPTIONS.length).toBeGreaterThanOrEqual(1);
    for (const m of FINANCIAL_MISCONCEPTIONS) {
      expect(m.skillId).toBe('SK-FIN-coin-value');
      for (const sid of m.remediationStrategyIds) expect(strategyIds.has(sid)).toBe(true);
    }
  });

  it('is a Financial-literacy competency graph (financial:money-value)', () => {
    expect(FINANCIAL_SKILLS.every((s) => s.domain === 'math')).toBe(true);
    expect(FINANCIAL_SKILLS.every((s) => s.competency === 'financial:money-value')).toBe(true);
  });
});
