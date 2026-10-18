import { describe, it, expect } from 'vitest';
import {
  FRACTIONS_OVERLAY,
  ADDITION_OVERLAY,
  ENGLISH_OVERLAY,
  OVERLAYS,
  OVERLAY_SKILLS,
  validateOverlay,
  validateAllOverlays,
  allOverlayMappings,
  allOverlaySkills,
  buildProposedOverlayGraph,
  buildOverlayWorksheet,
  skillsForExpectation,
  overlayCoverage,
  ontarioDatasets,
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

describe('multi-domain overlay registry', () => {
  it('registers three worked domains, all unsigned', () => {
    expect(OVERLAYS.map((o) => o.domainId)).toEqual(['fractions', 'addition', 'english']);
    for (const o of OVERLAYS) {
      expect(o.mappings.length).toBeGreaterThan(0);
      expect(o.mappings.every((m) => m.reviewedBy === null)).toBe(true);
    }
    expect(() => validateAllOverlays()).not.toThrow();
  });

  it('mapping ids are globally unique across domains', () => {
    const all = allOverlayMappings();
    expect(all.length).toBe(
      FRACTIONS_OVERLAY.length + ADDITION_OVERLAY.length + ENGLISH_OVERLAY.length,
    );
    expect(new Set(all.map((m) => m.mappingId)).size).toBe(all.length);
  });

  it('addition + English links resolve to real catalogue codes and known skills', () => {
    expect(() => validateOverlay(ADDITION_OVERLAY, allOverlaySkills())).not.toThrow();
    expect(() => validateOverlay(ENGLISH_OVERLAY, allOverlaySkills())).not.toThrow();
    const add10 = ADDITION_OVERLAY.find((m) => m.sourceCode === 'B2.2' && m.grade === 1)!;
    expect(add10.expectationId).toBe('EXP-ONT-MATH-G1-B2.2');
    expect(add10.skillId).toBe('SK-NS-add-within10');
    const pluralBase = ENGLISH_OVERLAY.find((m) => m.grade === 1)!;
    expect(pluralBase.expectationId).toBe('EXP-ONT-LANGUAGE-G1-B2.6');
    expect(pluralBase.skillId).toBe('SK-EN-plural-base');
  });

  it('combined coverage now reaches language grades (fractions default stays fractions-only)', () => {
    const combined = overlayCoverage(allOverlayMappings());
    expect(combined.some((c) => c.subject === 'language' && c.mappedDraft > 0)).toBe(true);
    // the no-arg default is unchanged (back-compat): fractions pilot only
    expect(overlayCoverage().some((c) => c.subject === 'language' && c.mappedDraft > 0)).toBe(
      false,
    );
  });

  it('a per-domain proposed graph is acyclic and non-canonical (English)', () => {
    const english = OVERLAYS.find((o) => o.domainId === 'english')!;
    const g = buildProposedOverlayGraph(english.skills, english.dependencies);
    expect(g.skillCount()).toBe(english.skills.length);
    expect(g.hasCycle()).toBe(false);
    for (const s of english.skills) expect(g.directPrerequisites(s.skillId)).toEqual([]);
  });
});

describe('educator coverage worksheet', () => {
  const rows = buildOverlayWorksheet();
  const totalExpectations = ontarioDatasets().reduce((n, d) => n + d.expectations.length, 0);

  it('has exactly one row per catalogue expectation', () => {
    expect(rows.length).toBe(totalExpectations);
    expect(new Set(rows.map((r) => r.expectationId)).size).toBe(rows.length);
  });

  it('every row is either a DRAFT proposal or an explicit gap — never validated', () => {
    for (const r of rows) {
      expect(r.status === 'PROPOSED (unsigned)' || r.status === 'UNMAPPED').toBe(true);
      if (r.status === 'UNMAPPED') {
        expect(r.proposedSkillIds).toBe('');
      } else {
        expect(r.proposedSkillIds.length).toBeGreaterThan(0);
      }
    }
    // the mapped rows equal the distinct expectations the overlays propose
    const mappedRows = rows.filter((r) => r.status === 'PROPOSED (unsigned)').length;
    expect(mappedRows).toBe(new Set(allOverlayMappings().map((m) => m.expectationId)).size);
    // the overwhelming majority remains unmapped — this is a gap list, not coverage
    expect(rows.filter((r) => r.status === 'UNMAPPED').length).toBeGreaterThan(mappedRows);
  });

  it('a worked proposal and a known gap both appear', () => {
    const proposed = rows.find((r) => r.expectationId === 'EXP-ONT-MATH-G3-B2.8')!;
    expect(proposed.proposedSkillIds).toContain('SK-FR-nonunit');
    expect(proposed.status).toBe('PROPOSED (unsigned)');
    // a Grade 8 language expectation is unmapped (no overlay touches it yet)
    const gap = rows.find((r) => r.subject === 'language' && r.grade === 8)!;
    expect(gap.status).toBe('UNMAPPED');
  });
});
