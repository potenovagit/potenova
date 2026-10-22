import { describe, it, expect } from 'vitest';
import {
  validateAssessmentPool,
  verifyMathCheck,
  type AssessmentPool,
  type PoolItem,
} from '@potenova/content';

/**
 * Workstream-B automated pool-validation gate. Synthetic fixtures only.
 * Confirms the gate re-derives gold keys by exact arithmetic and enforces the
 * structural rules a pool must satisfy before it can be frozen.
 */

// A minimal item builder.
function item(
  over: Partial<PoolItem> &
    Pick<PoolItem, 'itemId' | 'itemFamilyId' | 'skillId' | 'gradeTarget' | 'dimension'>,
): PoolItem {
  return {
    sourceExpectationCode: 'B1.7',
    representation: 'area-model',
    mode: over.dimension === 'transfer' ? 'transfer_check' : 'independent_check',
    options: [
      { id: 'A', text: 'correct', correct: true },
      { id: 'B', text: 'wrong', misconceptionId: 'MC-FR-denom-size' },
    ],
    goldKey: 'A',
    goldVerification: { mathCheck: { left: '1/2', right: '2/4', relation: 'equal', true: true } },
    ...over,
  };
}

/** A complete, valid single assessed-core cell (SK-FR-equiv G3): the quota is
 *  model≥1, value≥2 families, reasoning≥1, transfer≥1. */
function validEquivG3Cell(): PoolItem[] {
  const base = { skillId: 'SK-FR-equiv', gradeTarget: 3, sourceExpectationCode: 'B1.7' } as const;
  return [
    item({ ...base, itemId: 'm1', itemFamilyId: 'fam-m1', dimension: 'model' }),
    item({ ...base, itemId: 'v1', itemFamilyId: 'fam-v1', dimension: 'value' }),
    item({ ...base, itemId: 'v2', itemFamilyId: 'fam-v2', dimension: 'value' }),
    item({ ...base, itemId: 'r1', itemFamilyId: 'fam-r1', dimension: 'reasoning' }),
    item({
      ...base,
      itemId: 't1',
      itemFamilyId: 'fam-t1',
      dimension: 'transfer',
      // a genuine non-equivalence transfer: 2/3 vs 1/2, "equal" is false
      goldVerification: {
        mathCheck: { left: '2/3', right: '1/2', relation: 'equal', true: false },
      },
    }),
  ];
}

describe('pool-validate (Workstream-B gate)', () => {
  it('a well-formed assessed-core cell passes with 0 errors and verifies every gold key', () => {
    const pool: AssessmentPool = { poolVersion: 'test', items: validEquivG3Cell() };
    const r = validateAssessmentPool(pool);
    expect(r.ok).toBe(true);
    expect(r.errors).toBe(0);
    expect(r.goldKeysVerified).toBe(5);
    expect(r.coverage[0]!.meetsQuota).toBe(true);
  });

  it('exact arithmetic catches an UNSOUND gold key the metadata claims is true', () => {
    // 2/3 = 1/2 asserted true — arithmetic says false → unsound key
    expect(verifyMathCheck({ left: '2/3', right: '1/2', relation: 'equal', true: true })).toBe(
      false,
    );
    const items = validEquivG3Cell();
    items[1] = item({
      skillId: 'SK-FR-equiv',
      gradeTarget: 3,
      itemId: 'v1',
      itemFamilyId: 'fam-v1',
      dimension: 'value',
      goldVerification: { mathCheck: { left: '2/3', right: '1/2', relation: 'equal', true: true } },
    });
    const r = validateAssessmentPool({ items });
    expect(r.ok).toBe(false);
    expect(r.findings.some((f) => f.code === 'unsound-goldkey')).toBe(true);
  });

  it('verifyMathCheck accepts a genuine non-equivalence (true=false) and a real inequality', () => {
    expect(verifyMathCheck({ left: '2/3', right: '1/2', relation: 'equal', true: false })).toBe(
      true,
    );
    expect(verifyMathCheck({ left: '1/4', right: '1/6', relation: 'greater', true: true })).toBe(
      true,
    );
    expect(verifyMathCheck({ left: '1/10', right: '1/2', relation: 'less', true: true })).toBe(
      true,
    );
    expect(verifyMathCheck({ left: '3/4', right: '6/8', relation: 'equal', true: true })).toBe(
      true,
    );
  });

  it('flags more than one correct option', () => {
    const items = validEquivG3Cell();
    items[0] = {
      ...items[0]!,
      options: [
        { id: 'A', text: 'c', correct: true },
        { id: 'B', text: 'also', correct: true },
      ],
    };
    const r = validateAssessmentPool({ items });
    expect(r.findings.some((f) => f.code === 'one-correct')).toBe(true);
  });

  it('errors on an out-of-set misconception and warns on an untagged distractor', () => {
    const items = validEquivG3Cell();
    items[0] = {
      ...items[0]!,
      options: [
        { id: 'A', text: 'c', correct: true },
        { id: 'B', text: 'bad', misconceptionId: 'MC-FR-not-a-thing' },
        { id: 'C', text: 'untagged' },
      ],
    };
    const r = validateAssessmentPool({ items });
    expect(r.findings.some((f) => f.code === 'bad-misconception' && f.severity === 'error')).toBe(
      true,
    );
    expect(
      r.findings.some((f) => f.code === 'untagged-distractor' && f.severity === 'warning'),
    ).toBe(true);
  });

  it('errors on a wrong curriculum code for the skill×grade', () => {
    const items = validEquivG3Cell();
    items[0] = { ...items[0]!, sourceExpectationCode: 'B1.4' }; // equiv G3 must be B1.7
    const r = validateAssessmentPool({ items });
    expect(r.findings.some((f) => f.code === 'curriculum-code')).toBe(true);
  });

  it('errors when a transfer item is not in transfer_check mode', () => {
    const items = validEquivG3Cell();
    items[4] = { ...items[4]!, mode: 'independent_check' };
    const r = validateAssessmentPool({ items });
    expect(r.findings.some((f) => f.code === 'transfer-mode')).toBe(true);
  });

  it('errors on a duplicate item family', () => {
    const items = validEquivG3Cell();
    items[1] = { ...items[1]!, itemFamilyId: 'fam-m1' }; // collide with the model family
    const r = validateAssessmentPool({ items });
    expect(r.findings.some((f) => f.code === 'duplicate-family')).toBe(true);
  });

  it('errors when a cell is below the coverage quota (only 1 value family)', () => {
    const items = validEquivG3Cell().filter((i) => i.itemId !== 'v2'); // drop a value family
    const r = validateAssessmentPool({ items });
    expect(r.findings.some((f) => f.code === 'coverage')).toBe(true);
    expect(r.ok).toBe(false);
  });

  it('warns on a G5 literal denominator over 12', () => {
    const r = validateAssessmentPool({
      items: [
        item({
          skillId: 'SK-FR-equiv',
          gradeTarget: 5,
          itemId: 'x',
          itemFamilyId: 'fam-x',
          dimension: 'value',
          sourceExpectationCode: 'B1.3',
          goldVerification: {
            mathCheck: { left: '4/5', right: '12/15', relation: 'equal', true: true },
          },
        }),
      ],
    });
    expect(r.findings.some((f) => f.code === 'g5-denominator' && f.severity === 'warning')).toBe(
      true,
    );
  });
});
