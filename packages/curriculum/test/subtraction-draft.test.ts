import { describe, it, expect } from 'vitest';
import {
  buildSubtractionDraftGraph,
  SUBTRACTION_SKILLS,
  SUBTRACTION_DEPENDENCIES,
  SUBTRACTION_MISCONCEPTIONS,
  SUBTRACTION_STRATEGIES,
} from '@potenova/curriculum';

describe('DRAFT subtraction strand (number-sense counterpart to addition)', () => {
  const g = buildSubtractionDraftGraph();

  it('is acyclic and exposes the within10 → within20 prerequisite chain', () => {
    expect(g.hasCycle()).toBe(false);
    expect(g.skillCount()).toBe(SUBTRACTION_SKILLS.length);
    expect(g.directPrerequisites('SK-NS-sub-within20')).toEqual(['SK-NS-sub-within10']);
    expect(g.directPrerequisites('SK-NS-sub-within10')).toEqual([]);
  });

  it('AT-08: the subtraction remediation target has a reachable prerequisite to teach', () => {
    const closure = g.prerequisiteClosure('SK-NS-sub-within20');
    expect(closure).toEqual(expect.arrayContaining(['SK-NS-sub-within10']));
    expect(SUBTRACTION_DEPENDENCIES[0].type).toBe('hardPrerequisite');
  });

  it('seeds a misconception KB tied to real skills, with a remediation strategy', () => {
    const skillIds = new Set(SUBTRACTION_SKILLS.map((s) => s.skillId));
    const strategyIds = new Set(SUBTRACTION_STRATEGIES.map((s) => s.strategyId));
    expect(SUBTRACTION_MISCONCEPTIONS.length).toBeGreaterThanOrEqual(1);
    for (const m of SUBTRACTION_MISCONCEPTIONS) {
      expect(skillIds.has(m.skillId)).toBe(true);
      for (const sid of m.remediationStrategyIds) expect(strategyIds.has(sid)).toBe(true);
    }
  });

  it('is a distinct Math competency graph (number:subtraction)', () => {
    expect(SUBTRACTION_SKILLS.every((s) => s.domain === 'math')).toBe(true);
    expect(SUBTRACTION_SKILLS.every((s) => s.competency === 'number:subtraction')).toBe(true);
  });
});
