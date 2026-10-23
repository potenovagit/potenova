import { describe, it, expect } from 'vitest';
import {
  buildWholeNumberDraftGraph,
  WHOLE_NUMBER_SKILLS,
  WHOLE_NUMBER_DEPENDENCIES,
  WHOLE_NUMBER_MISCONCEPTIONS,
  WHOLE_NUMBER_STRATEGIES,
} from '@potenova/curriculum';

describe('DRAFT whole-number compare/order strand (G1 B1.3)', () => {
  const g = buildWholeNumberDraftGraph();

  it('is acyclic and exposes the compare → order prerequisite chain', () => {
    expect(g.hasCycle()).toBe(false);
    expect(g.skillCount()).toBe(WHOLE_NUMBER_SKILLS.length);
    expect(g.directPrerequisites('SK-NS-order-whole-50')).toEqual(['SK-NS-compare-whole-50']);
    expect(g.directPrerequisites('SK-NS-compare-whole-50')).toEqual([]);
  });

  it('AT-08: ordering has a reachable prerequisite (comparison) to teach', () => {
    const closure = g.prerequisiteClosure('SK-NS-order-whole-50');
    expect(closure).toEqual(expect.arrayContaining(['SK-NS-compare-whole-50']));
    expect(WHOLE_NUMBER_DEPENDENCIES[0].type).toBe('hardPrerequisite');
  });

  it('seeds a misconception KB tied to real skills, with a remediation strategy', () => {
    const skillIds = new Set(WHOLE_NUMBER_SKILLS.map((s) => s.skillId));
    const strategyIds = new Set(WHOLE_NUMBER_STRATEGIES.map((s) => s.strategyId));
    expect(WHOLE_NUMBER_MISCONCEPTIONS.length).toBeGreaterThanOrEqual(1);
    for (const m of WHOLE_NUMBER_MISCONCEPTIONS) {
      expect(skillIds.has(m.skillId)).toBe(true);
      for (const sid of m.remediationStrategyIds) expect(strategyIds.has(sid)).toBe(true);
    }
  });

  it('is a distinct Math competency graph (number:whole-number)', () => {
    expect(WHOLE_NUMBER_SKILLS.every((s) => s.domain === 'math')).toBe(true);
    expect(WHOLE_NUMBER_SKILLS.every((s) => s.competency === 'number:whole-number')).toBe(true);
  });
});
