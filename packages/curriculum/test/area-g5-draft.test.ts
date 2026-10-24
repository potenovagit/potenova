import { describe, it, expect } from 'vitest';
import {
  buildAreaG5DraftGraph,
  AREA_G5_SKILLS,
  AREA_G5_MISCONCEPTIONS,
  AREA_G5_STRATEGIES,
} from '@potenova/curriculum';

describe('DRAFT parallelogram/triangle area strand (G5 exp 43)', () => {
  const g = buildAreaG5DraftGraph();

  it('is a two-skill acyclic graph (parallelogram before triangle)', () => {
    expect(g.hasCycle()).toBe(false);
    expect(g.skillCount()).toBe(AREA_G5_SKILLS.length);
    expect(AREA_G5_SKILLS.map((s) => s.skillId)).toEqual([
      'SK-ME-parallelogram-area',
      'SK-ME-triangle-area',
    ]);
  });

  it('seeds a misconception for each skill, each with a known remediation strategy', () => {
    const strategyIds = new Set(AREA_G5_STRATEGIES.map((s) => s.strategyId));
    const skillIds = new Set(AREA_G5_SKILLS.map((s) => s.skillId));
    expect(AREA_G5_MISCONCEPTIONS.length).toBeGreaterThanOrEqual(2);
    for (const mc of AREA_G5_MISCONCEPTIONS) {
      expect(skillIds.has(mc.skillId)).toBe(true);
      for (const sid of mc.remediationStrategyIds) expect(strategyIds.has(sid)).toBe(true);
    }
  });

  it('is a Measurement area graph', () => {
    expect(AREA_G5_SKILLS.every((s) => s.domain === 'math')).toBe(true);
    expect(AREA_G5_SKILLS.every((s) => s.competency === 'measurement:area')).toBe(true);
  });
});
