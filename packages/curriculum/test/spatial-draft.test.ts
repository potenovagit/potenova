import { describe, it, expect } from 'vitest';
import {
  buildSpatialDraftGraph,
  SPATIAL_SKILLS,
  SPATIAL_MISCONCEPTIONS,
  SPATIAL_STRATEGIES,
} from '@potenova/curriculum';

describe('DRAFT spatial-sense strand (G1 E1.4 — positional language, selection)', () => {
  const g = buildSpatialDraftGraph();

  it('is a single-skill acyclic graph', () => {
    expect(g.hasCycle()).toBe(false);
    expect(g.skillCount()).toBe(SPATIAL_SKILLS.length);
    expect(SPATIAL_SKILLS.map((s) => s.skillId)).toEqual(['SK-GEO-positional-language']);
  });

  it('seeds a misconception KB tied to the skill, with a remediation strategy', () => {
    const strategyIds = new Set(SPATIAL_STRATEGIES.map((s) => s.strategyId));
    expect(SPATIAL_MISCONCEPTIONS.length).toBeGreaterThanOrEqual(1);
    for (const m of SPATIAL_MISCONCEPTIONS) {
      expect(m.skillId).toBe('SK-GEO-positional-language');
      for (const sid of m.remediationStrategyIds) expect(strategyIds.has(sid)).toBe(true);
    }
  });

  it('is a Spatial-sense competency graph (spatial:position)', () => {
    expect(SPATIAL_SKILLS.every((s) => s.domain === 'math')).toBe(true);
    expect(SPATIAL_SKILLS.every((s) => s.competency === 'spatial:position')).toBe(true);
  });
});
