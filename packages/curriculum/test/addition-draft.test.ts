import { describe, it, expect } from 'vitest';
import {
  buildAdditionDraftGraph,
  ADDITION_SKILLS,
  ADDITION_DEPENDENCIES,
  ADDITION_MISCONCEPTIONS,
  ADDITION_STRATEGIES,
} from '@potenova/curriculum';

describe('DRAFT addition strand (second Math graph — engine scales past one strand)', () => {
  const g = buildAdditionDraftGraph();

  it('is acyclic and exposes the within10 → within20 prerequisite chain', () => {
    expect(g.hasCycle()).toBe(false);
    expect(g.skillCount()).toBe(ADDITION_SKILLS.length);
    // within20 (crossing ten) depends on within10 (no regrouping)
    expect(g.directPrerequisites('SK-NS-add-within20')).toEqual(['SK-NS-add-within10']);
    // within10 is the entry node — no prerequisites
    expect(g.directPrerequisites('SK-NS-add-within10')).toEqual([]);
  });

  it('AT-08: the addition remediation target has a reachable prerequisite to teach', () => {
    const closure = g.prerequisiteClosure('SK-NS-add-within20');
    expect(closure).toEqual(expect.arrayContaining(['SK-NS-add-within10']));
    expect(ADDITION_DEPENDENCIES[0].type).toBe('hardPrerequisite');
  });

  it('seeds a misconception KB tied to real skills, with a remediation strategy', () => {
    const skillIds = new Set(ADDITION_SKILLS.map((s) => s.skillId));
    const strategyIds = new Set(ADDITION_STRATEGIES.map((s) => s.strategyId));
    expect(ADDITION_MISCONCEPTIONS.length).toBeGreaterThanOrEqual(1);
    for (const m of ADDITION_MISCONCEPTIONS) {
      expect(skillIds.has(m.skillId)).toBe(true);
      for (const sid of m.remediationStrategyIds) expect(strategyIds.has(sid)).toBe(true);
    }
  });

  it('is a distinct Math competency graph (number:addition), not the fractions graph', () => {
    expect(ADDITION_SKILLS.every((s) => s.domain === 'math')).toBe(true);
    expect(ADDITION_SKILLS.every((s) => s.competency === 'number:addition')).toBe(true);
  });
});
