import { describe, it, expect } from 'vitest';
import { ageBandForGrade, under13ByGrade, AGE_BANDS } from '@potenova/identity';
import { isDomainError } from '@potenova/contracts';

describe('age-band taxonomy — F-08 (Ontario divisions)', () => {
  it('maps every in-range grade to the correct division', () => {
    const expected: Array<[number, string]> = [
      [1, 'primary'],
      [3, 'primary'],
      [4, 'junior'],
      [6, 'junior'],
      [7, 'intermediate'],
      [8, 'intermediate'],
    ];
    for (const [grade, band] of expected) {
      expect(ageBandForGrade(grade)).toBe(band);
    }
    expect(AGE_BANDS).toEqual(['primary', 'junior', 'intermediate']);
  });

  it('rejects grades outside Ontario G1-8 (and non-integers)', () => {
    for (const g of [0, 9, -1, 2.5]) {
      try {
        ageBandForGrade(g);
        throw new Error('expected POLICY_BLOCKED');
      } catch (e) {
        expect(isDomainError(e) && e.code).toBe('POLICY_BLOCKED');
      }
    }
  });

  it('under-13 flag: confident for Grades 1-7, boundary (false) at Grade 8', () => {
    expect(under13ByGrade(2)).toBe(true);
    expect(under13ByGrade(7)).toBe(true);
    expect(under13ByGrade(8)).toBe(false);
  });
});
