import { describe, it, expect } from 'vitest';
import {
  buildConstructionDraftGraph,
  CONSTRUCTION_SKILLS,
  CONSTRUCTION_MISCONCEPTIONS,
  CONSTRUCTION_STRATEGIES,
} from '@potenova/curriculum';

describe('DRAFT construction strand (G1 B1.1/B1.2 — build a number)', () => {
  const g = buildConstructionDraftGraph();

  it('is a single-skill acyclic graph', () => {
    expect(g.hasCycle()).toBe(false);
    expect(g.skillCount()).toBe(CONSTRUCTION_SKILLS.length);
    expect(CONSTRUCTION_SKILLS.map((s) => s.skillId)).toEqual(['SK-NS-build-number']);
  });

  it('seeds a misconception KB tied to the skill, with a remediation strategy', () => {
    const strategyIds = new Set(CONSTRUCTION_STRATEGIES.map((s) => s.strategyId));
    expect(CONSTRUCTION_MISCONCEPTIONS.length).toBeGreaterThanOrEqual(1);
    for (const m of CONSTRUCTION_MISCONCEPTIONS) {
      expect(m.skillId).toBe('SK-NS-build-number');
      for (const sid of m.remediationStrategyIds) expect(strategyIds.has(sid)).toBe(true);
    }
  });

  it('is a Number competency graph (number:composition-build)', () => {
    expect(CONSTRUCTION_SKILLS.every((s) => s.domain === 'math')).toBe(true);
    expect(CONSTRUCTION_SKILLS.every((s) => s.competency === 'number:composition-build')).toBe(
      true,
    );
  });
});
