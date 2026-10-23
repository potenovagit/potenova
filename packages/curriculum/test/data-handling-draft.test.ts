import { describe, it, expect } from 'vitest';
import {
  buildDataHandlingDraftGraph,
  DATA_SKILLS,
  DATA_MISCONCEPTIONS,
  DATA_STRATEGIES,
} from '@potenova/curriculum';

describe('DRAFT data-handling strand (G1 Data — read/interpret a graph, selection)', () => {
  const g = buildDataHandlingDraftGraph();

  it('is a single-skill acyclic graph', () => {
    expect(g.hasCycle()).toBe(false);
    expect(g.skillCount()).toBe(DATA_SKILLS.length);
    expect(DATA_SKILLS.map((s) => s.skillId)).toEqual(['SK-DATA-interpret-graph']);
  });

  it('seeds a misconception KB tied to the skill, with a remediation strategy', () => {
    const strategyIds = new Set(DATA_STRATEGIES.map((s) => s.strategyId));
    expect(DATA_MISCONCEPTIONS.length).toBeGreaterThanOrEqual(1);
    for (const m of DATA_MISCONCEPTIONS) {
      expect(m.skillId).toBe('SK-DATA-interpret-graph');
      for (const sid of m.remediationStrategyIds) expect(strategyIds.has(sid)).toBe(true);
    }
  });

  it('is a Data competency graph (data:interpret)', () => {
    expect(DATA_SKILLS.every((s) => s.domain === 'math')).toBe(true);
    expect(DATA_SKILLS.every((s) => s.competency === 'data:interpret')).toBe(true);
  });
});
