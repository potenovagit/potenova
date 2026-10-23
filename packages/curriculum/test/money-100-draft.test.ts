import { describe, it, expect } from 'vitest';
import {
  buildMoney100DraftGraph,
  MONEY_100_SKILLS,
  MONEY_100_MISCONCEPTIONS,
  MONEY_100_STRATEGIES,
} from '@potenova/curriculum';

describe('DRAFT money-to-$100 strand (G2 F1.1)', () => {
  const g = buildMoney100DraftGraph();

  it('is a single-skill acyclic graph', () => {
    expect(g.hasCycle()).toBe(false);
    expect(g.skillCount()).toBe(MONEY_100_SKILLS.length);
    expect(MONEY_100_SKILLS.map((s) => s.skillId)).toEqual(['SK-FIN-money-100']);
  });

  it('seeds a misconception KB tied to the skill, with a remediation strategy', () => {
    const strategyIds = new Set(MONEY_100_STRATEGIES.map((s) => s.strategyId));
    expect(MONEY_100_MISCONCEPTIONS.length).toBeGreaterThanOrEqual(1);
    for (const m of MONEY_100_MISCONCEPTIONS) {
      expect(m.skillId).toBe('SK-FIN-money-100');
      for (const sid of m.remediationStrategyIds) expect(strategyIds.has(sid)).toBe(true);
    }
  });

  it('is a Financial Literacy money-value graph', () => {
    expect(MONEY_100_SKILLS.every((s) => s.domain === 'math')).toBe(true);
    expect(MONEY_100_SKILLS.every((s) => s.competency === 'financial:money-value')).toBe(true);
  });
});
