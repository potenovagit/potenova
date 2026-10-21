import { describe, it, expect } from 'vitest';
import {
  CONCEPTUAL_PROBES,
  EQUIV_PROBES_G3,
  EQUIV_PROBES_G5,
  scoreProbe,
  type EvidenceDimension,
} from '@potenova/content';

/** DRAFT grade-calibrated conceptual probes (educator Stage-1 Annex B). */
describe('conceptual probes (DRAFT)', () => {
  const dims: EvidenceDimension[] = ['model', 'value', 'reasoning', 'transfer'];

  it('covers all four dimensions at BOTH Grade 3 and Grade 5', () => {
    for (const set of [EQUIV_PROBES_G3, EQUIV_PROBES_G5]) {
      for (const d of dims) {
        expect(set.some((p) => p.dimension === d)).toBe(true);
      }
    }
    // grade calibration: G3 and G5 probes are genuinely different items
    expect(EQUIV_PROBES_G3.every((p) => p.gradeTarget === 3)).toBe(true);
    expect(EQUIV_PROBES_G5.every((p) => p.gradeTarget === 5)).toBe(true);
    const g3Families = new Set(EQUIV_PROBES_G3.map((p) => p.itemFamilyId));
    const g5Families = new Set(EQUIV_PROBES_G5.map((p) => p.itemFamilyId));
    expect([...g3Families].some((f) => g5Families.has(f))).toBe(false);
  });

  it('every probe is DRAFT/unapproved and carries a grade + expectation tag', () => {
    for (const p of CONCEPTUAL_PROBES) {
      expect(p.approved).toBe(false);
      expect(p.sourceExpectationCode).toBeTruthy();
      expect(p.gradeTarget).toBeGreaterThan(0);
      expect(p.options.filter((o) => o.correct)).toHaveLength(1); // exactly one correct
    }
  });

  it('reasoning distractors are tagged with the misconception they reveal', () => {
    const reasoning = CONCEPTUAL_PROBES.filter((p) => p.dimension === 'reasoning');
    for (const p of reasoning) {
      for (const o of p.options.filter((x) => !x.correct)) {
        expect(o.misconceptionId).toBeTruthy();
      }
    }
  });

  it('scores a correct choice correct, and a distractor as wrong with its misconception', () => {
    const reason = EQUIV_PROBES_G5.find((p) => p.dimension === 'reasoning')!;
    const correct = reason.options.find((o) => o.correct)!;
    const distractor = reason.options.find((o) => !o.correct)!;
    expect(scoreProbe(reason, correct.id)).toEqual({ correct: true });
    const bad = scoreProbe(reason, distractor.id);
    expect(bad.correct).toBe(false);
    expect(bad.misconceptionId).toBe(distractor.misconceptionId);
  });
});
