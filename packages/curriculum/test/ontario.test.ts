import { describe, it, expect } from 'vitest';
import {
  ontarioDatasets,
  ontarioDataset,
  ontarioExpectations,
  ontarioRelease,
  ontarioCoverage,
  validateOntarioData,
} from '@potenova/curriculum';

/**
 * Ontario curriculum catalogue (ADR-0022). Source-verified Grade 1 Math + Language
 * loaded as the spine; grades 2–8 add data files. This is the authoritative
 * catalogue, DRAFT until educator review — never the teachable-skill overlay or
 * any mastery threshold.
 */

describe('ontario curriculum catalogue', () => {
  it('loads Grade 1 math and language, all DRAFT with provenance', () => {
    const cov = ontarioCoverage();
    const math = cov.find((c) => c.subject === 'math' && c.grade === 1);
    const lang = cov.find((c) => c.subject === 'language' && c.grade === 1);
    expect(math).toMatchObject({ strands: 5, expectations: 38, reviewStatus: 'draft' });
    expect(lang).toMatchObject({ strands: 4, expectations: 63, reviewStatus: 'draft' });
    for (const d of ontarioDatasets()) {
      expect(d.sourceUrl).toMatch(/dcp\.edu\.gov\.on\.ca/);
      expect(d.extractedAt).toBeTruthy();
      expect(d.reviewStatus).toBe('draft');
    }
  });

  it('loads Grade 2 math and language, all DRAFT with provenance', () => {
    const cov = ontarioCoverage();
    const math = cov.find((c) => c.subject === 'math' && c.grade === 2);
    const lang = cov.find((c) => c.subject === 'language' && c.grade === 2);
    expect(math).toMatchObject({ strands: 5, expectations: 39, reviewStatus: 'draft' });
    expect(lang).toMatchObject({ strands: 4, expectations: 61, reviewStatus: 'draft' });
  });

  it('every dataset passes structural validation', () => {
    for (const d of ontarioDatasets()) {
      expect(() => validateOntarioData(d)).not.toThrow();
    }
  });

  it('rejects structurally broken data', () => {
    const base = ontarioDataset('math', 1)!;
    // Duplicate code
    expect(() =>
      validateOntarioData({
        ...base,
        expectations: [...base.expectations, base.expectations[0]],
      }),
    ).toThrow(/duplicate/);
    // Code whose strand prefix disagrees with its strand field
    expect(() =>
      validateOntarioData({
        ...base,
        expectations: [{ sourceCode: 'B1.1', strand: 'C', overallCode: 'B1', text: 'x y z' }],
      }),
    ).toThrow(/strand/);
    // Specific code not under its stated overall
    expect(() =>
      validateOntarioData({
        ...base,
        expectations: [{ sourceCode: 'B1.1', strand: 'B', overallCode: 'B2', text: 'x y z' }],
      }),
    ).toThrow(/not under/);
  });

  it('produces CurriculumExpectations keyed by the real Ontario code, draft status', () => {
    const d = ontarioDataset('math', 1)!;
    const exps = ontarioExpectations(d);
    expect(exps).toHaveLength(38);
    const b11 = exps.find((e) => e.sourceCode === 'B1.1')!;
    expect(b11.statementRef).toMatch(/whole numbers up to and including 50/);
    expect(b11.strand).toBe('Number');
    expect(b11.grade).toBe(1);
    expect(b11.reviewStatus).toBe('draft');
    expect(exps.every((e) => e.reviewStatus === 'draft')).toBe(true);
    // Every expectation id is unique.
    expect(new Set(exps.map((e) => e.expectationId)).size).toBe(exps.length);
  });

  it('builds a DRAFT release with source provenance', () => {
    const d = ontarioDataset('language', 1)!;
    const rel = ontarioRelease(d);
    expect(rel.status).toBe('draft');
    expect(rel.jurisdiction).toBe('ontario');
    expect(rel.subject).toBe('language');
    expect(rel.sourceUrl).toMatch(/elementary-language/);
  });

  it('language strands are A–D and codes resolve to strand names', () => {
    const d = ontarioDataset('language', 1)!;
    expect(d.strands.map((s) => s.code)).toEqual(['A', 'B', 'C', 'D']);
    const exps = ontarioExpectations(d);
    const a11 = exps.find((e) => e.sourceCode === 'A1.1')!;
    expect(a11.strand).toBe('Literacy Connections and Applications');
  });
});
