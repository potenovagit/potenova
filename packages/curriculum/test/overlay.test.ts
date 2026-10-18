import { describe, it, expect } from 'vitest';
import {
  FRACTIONS_OVERLAY,
  OVERLAY_SKILLS,
  validateOverlay,
  buildProposedOverlayGraph,
  skillsForExpectation,
  overlayCoverage,
  type ProposedSkillMapping,
} from '@potenova/curriculum';

/**
 * Teachable-skill overlay (ADR-0023). A PROPOSAL layer over the source-verified
 * Ontario catalogue: expectation -> teachable skill links, all unsigned, plus a
 * proposed (never canonical) prerequisite graph. Sets no mastery thresholds.
 */

const base = FRACTIONS_OVERLAY[0];

describe('teachable-skill overlay', () => {
  it('the fractions overlay loads and every link is DRAFT (unsigned)', () => {
    expect(FRACTIONS_OVERLAY.length).toBeGreaterThan(0);
    expect(FRACTIONS_OVERLAY.every((m) => m.reviewedBy === null)).toBe(true);
    expect(FRACTIONS_OVERLAY.every((m) => m.proposedBy === 'draft-authoring')).toBe(true);
    // mapping ids are unique
    expect(new Set(FRACTIONS_OVERLAY.map((m) => m.mappingId)).size).toBe(FRACTIONS_OVERLAY.length);
  });

  it('every link resolves to a real catalogue expectation and a known skill', () => {
    expect(() => validateOverlay(FRACTIONS_OVERLAY)).not.toThrow();
    // spot-check an anchor to a real Ontario code
    const g5compare = FRACTIONS_OVERLAY.find(
      (m) => m.subject === 'math' && m.grade === 5 && m.sourceCode === 'B1.4',
    )!;
    expect(g5compare.expectationId).toBe('EXP-ONT-MATH-G5-B1.4');
    expect(OVERLAY_SKILLS.some((s) => s.skillId === g5compare.skillId)).toBe(true);
  });

  it('rejects a link to an expectation not in the catalogue', () => {
    const bad: ProposedSkillMapping = {
      ...base,
      mappingId: 'PMAP-BAD-1',
      grade: 9, // no Grade 9 in the catalogue
      expectationId: 'EXP-ONT-MATH-G9-B1.6',
    };
    expect(() => validateOverlay([bad])).toThrow(/unknown expectation/);
  });

  it('rejects a link to an unknown skill', () => {
    const bad: ProposedSkillMapping = { ...base, mappingId: 'PMAP-BAD-2', skillId: 'SK-NOPE' };
    expect(() => validateOverlay([bad])).toThrow(/unknown skill/);
  });

  it('refuses a pre-signed link (DRAFT invariant)', () => {
    const signed = {
      ...base,
      mappingId: 'PMAP-BAD-3',
      reviewedBy: 'someone',
    } as unknown as ProposedSkillMapping;
    expect(() => validateOverlay([signed])).toThrow(/pre-signed/);
  });

  it('rejects an id that disagrees with its subject/grade/code', () => {
    const bad: ProposedSkillMapping = { ...base, mappingId: 'PMAP-BAD-4', sourceCode: 'B9.9' };
    expect(() => validateOverlay([bad])).toThrow(/mismatch/);
  });

  it('builds a proposed prerequisite graph that is acyclic and not canonical', () => {
    const g = buildProposedOverlayGraph();
    expect(g.skillCount()).toBe(OVERLAY_SKILLS.length);
    expect(g.hasCycle()).toBe(false);
    // proposed edges never affect traversal: no approved prerequisites exist
    for (const s of OVERLAY_SKILLS) {
      expect(g.directPrerequisites(s.skillId)).toEqual([]);
    }
  });

  it('maps a specific expectation to its proposed skill(s)', () => {
    // G3 B2.8 (numerator as repeated addition of a unit fraction) -> non-unit skill
    expect(skillsForExpectation('EXP-ONT-MATH-G3-B2.8')).toContain('SK-FR-nonunit');
  });

  it('coverage reports DRAFT mappings against the full catalogue, most still unmapped', () => {
    const cov = overlayCoverage();
    expect(cov).toHaveLength(16); // 2 subjects x 8 grades
    // the overlay is the fractions pilot only: every language grade is still 0
    expect(cov.filter((c) => c.subject === 'language').every((c) => c.mappedDraft === 0)).toBe(
      true,
    );
    // and some math grades now have at least one DRAFT mapping
    expect(cov.some((c) => c.subject === 'math' && c.mappedDraft > 0)).toBe(true);
    // mappedDraft never exceeds the grade's expectation count
    expect(cov.every((c) => c.mappedDraft <= c.expectations)).toBe(true);
  });
});
