import { describe, it, expect } from 'vitest';
import {
  buildSquaresG7DraftGraph,
  SQUARES_G7_SKILLS,
  SQUARES_G7_MISCONCEPTIONS,
  SQUARES_G7_STRATEGIES,
} from '@potenova/curriculum';

describe('DRAFT perfect-squares strand (G7 B1.2)', () => {
  const g = buildSquaresG7DraftGraph();

  it('is a two-skill acyclic graph', () => {
    expect(g.hasCycle()).toBe(false);
    expect(g.skillCount()).toBe(SQUARES_G7_SKILLS.length);
    expect(SQUARES_G7_SKILLS.map((s) => s.skillId).sort()).toEqual([
      'SK-NS-is-perfect-square',
      'SK-NS-perfect-square-root',
    ]);
  });

  it('seeds at least one misconception per skill, each with a known strategy', () => {
    const strategyIds = new Set(SQUARES_G7_STRATEGIES.map((s) => s.strategyId));
    const skillIds = new Set(SQUARES_G7_SKILLS.map((s) => s.skillId));
    expect(SQUARES_G7_MISCONCEPTIONS.length).toBeGreaterThanOrEqual(2);
    for (const mc of SQUARES_G7_MISCONCEPTIONS) {
      expect(skillIds.has(mc.skillId)).toBe(true);
      for (const sid of mc.remediationStrategyIds) expect(strategyIds.has(sid)).toBe(true);
    }
    for (const sid of skillIds) {
      expect(SQUARES_G7_MISCONCEPTIONS.some((mc) => mc.skillId === sid)).toBe(true);
    }
  });

  it('is a Number powers graph', () => {
    expect(SQUARES_G7_SKILLS.every((s) => s.domain === 'math')).toBe(true);
    expect(SQUARES_G7_SKILLS.every((s) => s.competency === 'number:powers')).toBe(true);
  });
});
