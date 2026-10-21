import { describe, it, expect } from 'vitest';
import {
  CONCEPTUAL_PROBES,
  EQUIV_PROBES_G3,
  EQUIV_PROBES_G4,
  EQUIV_PROBES_G5,
  scoreProbe,
  toChildFacing,
  type EvidenceDimension,
} from '@potenova/content';

/** DRAFT grade-calibrated conceptual probes (educator Stage-1 Annex B). */
describe('conceptual probes (DRAFT)', () => {
  const dims: EvidenceDimension[] = ['model', 'value', 'reasoning', 'transfer'];

  it('covers both skills (equiv + compare) across Grades 3–5, all four dimensions', () => {
    for (const skillId of ['SK-FR-equiv', 'SK-FR-compare']) {
      for (const grade of [3, 4, 5]) {
        for (const d of dims) {
          const hit = CONCEPTUAL_PROBES.some(
            (p) => p.skillId === skillId && p.gradeTarget === grade && p.dimension === d,
          );
          expect(hit, `${skillId} G${grade} ${d}`).toBe(true);
        }
      }
    }
  });

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

  // Correction #1: the correct option is not uniformly the first in source, and
  // the child-facing projection never exposes correctness.
  it('correct option is NOT always the first in source order', () => {
    const correctFirst = CONCEPTUAL_PROBES.filter((p) => p.options[0]!.correct).length;
    expect(correctFirst).toBeLessThan(CONCEPTUAL_PROBES.length);
  });

  it('toChildFacing strips correctness/misconception labels a child must not see', () => {
    for (const p of CONCEPTUAL_PROBES) {
      const child = toChildFacing(p, 'seed-1');
      expect(child.options).toHaveLength(p.options.length);
      for (const o of child.options) {
        expect(o).not.toHaveProperty('correct');
        expect(o).not.toHaveProperty('misconceptionId');
      }
      // every option id survives (so scoring can still resolve the choice)
      expect(new Set(child.options.map((o) => o.id))).toEqual(new Set(p.options.map((o) => o.id)));
    }
  });

  it('toChildFacing shuffles deterministically: same seed stable, different seeds vary somewhere', () => {
    const probe = CONCEPTUAL_PROBES.find((p) => p.options.length >= 3)!;
    const a = toChildFacing(probe, 's1').options.map((o) => o.id);
    const aAgain = toChildFacing(probe, 's1').options.map((o) => o.id);
    expect(aAgain).toEqual(a); // reproducible
    const anyReordered = CONCEPTUAL_PROBES.some((p) => {
      const x = toChildFacing(p, 's1')
        .options.map((o) => o.id)
        .join();
      const y = toChildFacing(p, 's2')
        .options.map((o) => o.id)
        .join();
      return x !== y;
    });
    expect(anyReordered).toBe(true);
  });

  // Correction #2: equivalence transfer items mix Yes and No across distinct families.
  it('equivalence TRANSFER items are not uniformly "Yes" and span distinct families', () => {
    const transfers = [EQUIV_PROBES_G3, EQUIV_PROBES_G4, EQUIV_PROBES_G5].map(
      (s) => s.find((p) => p.dimension === 'transfer')!,
    );
    const correctTexts = transfers.map((p) => p.options.find((o) => o.correct)!.text.toLowerCase());
    expect(correctTexts.some((t) => t.startsWith('yes'))).toBe(true);
    expect(correctTexts.some((t) => t.startsWith('no'))).toBe(true);
    expect(new Set(transfers.map((p) => p.itemFamilyId)).size).toBe(3);
  });

  // Correction #3: area-model model options carry an actual drawable picture,
  // so the child chooses between real alternative visuals, not descriptions.
  it('every area-model MODEL-dimension option carries a bar visual to render', () => {
    const areaModels = CONCEPTUAL_PROBES.filter(
      (x) => x.dimension === 'model' && x.representation === 'area-model',
    );
    expect(areaModels.length).toBeGreaterThan(0);
    for (const p of areaModels) {
      for (const o of p.options) {
        expect(o.visual?.kind).toBe('bars');
        expect(o.visual!.wholes.length).toBeGreaterThan(0);
      }
    }
  });

  // Correction #4: the retired G4 reasoning distractor is gone.
  it('the Grade-4 reasoning probe no longer uses the "2 is half of 4" distractor', () => {
    const g4reason = EQUIV_PROBES_G4.find((p) => p.dimension === 'reasoning')!;
    expect(g4reason.options.some((o) => /2 is half of 4/i.test(o.text))).toBe(false);
  });
});
