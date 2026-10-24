import { describe, it, expect } from 'vitest';
import {
  buildAreaG4DraftGraph,
  AREA_G4_SKILLS,
  AREA_G4_MISCONCEPTIONS,
  AREA_G4_STRATEGIES,
} from '@potenova/curriculum';

describe('DRAFT rectangle-area strand (G4 exp 41/42)', () => {
  const g = buildAreaG4DraftGraph();

  it('is a two-skill acyclic graph (area before missing side)', () => {
    expect(g.hasCycle()).toBe(false);
    expect(g.skillCount()).toBe(AREA_G4_SKILLS.length);
    expect(AREA_G4_SKILLS.map((s) => s.skillId)).toEqual([
      'SK-ME-rect-area',
      'SK-ME-rect-missing-side',
    ]);
  });

  it('seeds a misconception for each skill, each with a known remediation strategy', () => {
    const strategyIds = new Set(AREA_G4_STRATEGIES.map((s) => s.strategyId));
    const skillIds = new Set(AREA_G4_SKILLS.map((s) => s.skillId));
    expect(AREA_G4_MISCONCEPTIONS.length).toBeGreaterThanOrEqual(2);
    for (const mc of AREA_G4_MISCONCEPTIONS) {
      expect(skillIds.has(mc.skillId)).toBe(true);
      for (const sid of mc.remediationStrategyIds) expect(strategyIds.has(sid)).toBe(true);
    }
  });

  it('is a Measurement area graph', () => {
    expect(AREA_G4_SKILLS.every((s) => s.domain === 'math')).toBe(true);
    expect(AREA_G4_SKILLS.every((s) => s.competency === 'measurement:area')).toBe(true);
  });
});
