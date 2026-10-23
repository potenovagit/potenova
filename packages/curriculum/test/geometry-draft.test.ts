import { describe, it, expect } from 'vitest';
import {
  buildGeometryDraftGraph,
  GEOMETRY_SKILLS,
  GEOMETRY_MISCONCEPTIONS,
  GEOMETRY_STRATEGIES,
} from '@potenova/curriculum';

describe('DRAFT geometry strand (G1 E1.1–E1.3 — 2-D shapes by attribute, selection)', () => {
  const g = buildGeometryDraftGraph();

  it('is a single-skill acyclic graph', () => {
    expect(g.hasCycle()).toBe(false);
    expect(g.skillCount()).toBe(GEOMETRY_SKILLS.length);
    expect(GEOMETRY_SKILLS.map((s) => s.skillId)).toEqual(['SK-GEO-shape-attribute']);
  });

  it('seeds a misconception KB tied to the skill, with a remediation strategy', () => {
    const strategyIds = new Set(GEOMETRY_STRATEGIES.map((s) => s.strategyId));
    expect(GEOMETRY_MISCONCEPTIONS.length).toBeGreaterThanOrEqual(1);
    for (const m of GEOMETRY_MISCONCEPTIONS) {
      expect(m.skillId).toBe('SK-GEO-shape-attribute');
      for (const sid of m.remediationStrategyIds) expect(strategyIds.has(sid)).toBe(true);
    }
  });

  it('is a Geometry competency graph (geometry:2d-shapes)', () => {
    expect(GEOMETRY_SKILLS.every((s) => s.domain === 'math')).toBe(true);
    expect(GEOMETRY_SKILLS.every((s) => s.competency === 'geometry:2d-shapes')).toBe(true);
  });
});
