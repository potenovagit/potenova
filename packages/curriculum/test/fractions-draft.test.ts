import { describe, it, expect } from 'vitest';
import {
  buildFractionsDraftGraph,
  FRACTION_SKILLS,
  FRACTION_MISCONCEPTIONS,
  FRACTION_EXPECTATIONS,
  FRACTION_MAPPINGS,
} from '@potenova/curriculum';

describe('DRAFT fractions strand (F-09 G1 slice)', () => {
  const g = buildFractionsDraftGraph();

  it('is acyclic and exposes the expected prerequisite chain', () => {
    expect(g.hasCycle()).toBe(false);
    expect(g.skillCount()).toBe(FRACTION_SKILLS.length);
    // comparison depends (transitively) on unit, non-unit, equivalence and partitioning
    const closure = g.prerequisiteClosure('SK-FR-compare');
    expect(closure).toEqual(
      expect.arrayContaining(['SK-FR-nonunit', 'SK-FR-equiv', 'SK-FR-unit', 'SK-FR-partition']),
    );
    // partitioning is the entry node — it has no prerequisites
    expect(g.directPrerequisites('SK-FR-partition')).toEqual([]);
  });

  it('AT-08: the fraction remediation target has a reachable prerequisite to teach', () => {
    // "learner repeatedly misses a fraction prerequisite" → there is a prior skill to drop to
    expect(g.directPrerequisites('SK-FR-unit')).toEqual(['SK-FR-partition']);
  });

  it('seeds a misconception KB tied to real skills (LRN-008)', () => {
    const skillIds = new Set(FRACTION_SKILLS.map((s) => s.skillId));
    expect(FRACTION_MISCONCEPTIONS.length).toBeGreaterThanOrEqual(3);
    for (const m of FRACTION_MISCONCEPTIONS) {
      expect(skillIds.has(m.skillId)).toBe(true);
    }
  });

  it('carries DRAFT, unverified curriculum mapping (no fabricated coverage)', () => {
    // nothing here may masquerade as validated Ontario coverage
    expect(FRACTION_EXPECTATIONS.every((e) => e.reviewStatus === 'draft')).toBe(true);
    expect(
      FRACTION_EXPECTATIONS.every((e) => e.sourceCode === 'DRAFT-PENDING-CURRICULUM-REVIEW'),
    ).toBe(true);
    expect(FRACTION_MAPPINGS.every((m) => m.reviewedBy === null)).toBe(true);
  });
});
