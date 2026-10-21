/** The four conceptual evidence dimensions (mirrors learner-state's
 *  EvidenceDimension; kept local so content does not depend on learner-state). */
export type EvidenceDimension = 'model' | 'value' | 'reasoning' | 'transfer';

/**
 * DRAFT grade-calibrated conceptual probes — equivalence, Grades 3 & 5 (educator
 * Stage-1 Annex B). These demonstrate the model / value / reasoning / transfer
 * assessment for the educator to EXAMINE; they are NOT approved content.
 *
 * ============================================================================
 *  DRAFT / UNSIGNED. Distractors, reasoning options and grade-specific wording
 *  are the educator's to author and approve — these are scaffolds from the
 *  Stage-1 spec so the behaviour can be shown running on synthetic data. Nothing
 *  here reaches a child before G2. `approved: false` marks every probe.
 * ============================================================================
 *
 * All scoring is deterministic single-selection: the child chooses one option.
 * A wrong `reasoning` choice is tagged with the misconception it reveals, so the
 * engine can both withhold mastery (reasoning unmet) and route remediation.
 */

export interface ProbeOption {
  readonly id: string;
  readonly text: string;
  readonly correct: boolean;
  /** For an incorrect option: the misconception it reveals (coaching + diagnosis). */
  readonly misconceptionId?: string;
}

export interface ConceptualProbe {
  readonly probeId: string;
  readonly skillId: string;
  readonly gradeTarget: number;
  readonly sourceExpectationCode: string;
  readonly dimension: EvidenceDimension;
  /** Canonical family — distinct families are required to count independently. */
  readonly itemFamilyId: string;
  readonly representation: string;
  readonly prompt: string;
  readonly options: readonly ProbeOption[];
  readonly approved: false;
  readonly approvalRef: string;
}

const REF = 'CONCEPTUAL-PROBE-DRAFT-0.1(ER-CONTENT-UNCALIBRATED)';
const opt = (
  id: string,
  text: string,
  correct: boolean,
  misconceptionId?: string,
): ProbeOption => ({
  id,
  text,
  correct,
  ...(misconceptionId ? { misconceptionId } : {}),
});
type RawProbe = Omit<ConceptualProbe, 'approved' | 'approvalRef'>;
const stamp = (p: RawProbe): ConceptualProbe => ({ ...p, approved: false, approvalRef: REF });

/** Grade 3 — equivalence in a fair-sharing context (Ontario B1.7; 1/2 = 2/4). */
const RAW_EQUIV_G3: readonly RawProbe[] = [
  {
    probeId: 'PR-FR-equiv-model-G3',
    skillId: 'SK-FR-equiv',
    gradeTarget: 3,
    sourceExpectationCode: 'B1.7',
    dimension: 'model',
    itemFamilyId: 'equiv-g3-fairshare-half',
    representation: 'area-model',
    prompt:
      'Two paper strips are the SAME size. Which picture fairly shares each strip into equal parts?',
    options: [
      opt('a', 'One strip split into 2 equal parts; the other into 4 equal parts', true),
      opt('b', 'One strip split into 2 unequal parts', false, 'MC-FR-unequal-parts'),
      opt(
        'c',
        'A big strip and a small strip, each split in half',
        false,
        'MC-FR-different-wholes',
      ),
    ],
  },
  {
    probeId: 'PR-FR-equiv-value-G3',
    skillId: 'SK-FR-equiv',
    gradeTarget: 3,
    sourceExpectationCode: 'B1.7',
    dimension: 'value',
    itemFamilyId: 'equiv-g3-value-half',
    representation: 'area-model',
    prompt: 'Is one half (1/2) the same amount as two fourths (2/4) of the same-size whole?',
    options: [opt('t', 'Yes, the same amount', true), opt('f', 'No, different amounts', false)],
  },
  {
    probeId: 'PR-FR-equiv-reason-G3',
    skillId: 'SK-FR-equiv',
    gradeTarget: 3,
    sourceExpectationCode: 'B1.7',
    dimension: 'reasoning',
    itemFamilyId: 'equiv-g3-reason-half',
    representation: 'area-model',
    prompt: 'Why do 1/2 and 2/4 show the same amount?',
    options: [
      opt(
        'a',
        'They cover the same amount of the same-size whole, just cut into different numbers of pieces',
        true,
      ),
      opt('b', 'Because 2 and 4 are both even numbers', false, 'MC-FR-equiv-scale-one'),
      opt('c', 'Because each picture has some pieces shaded', false, 'MC-FR-different-wholes'),
    ],
  },
  {
    probeId: 'PR-FR-equiv-transfer-G3',
    skillId: 'SK-FR-equiv',
    gradeTarget: 3,
    sourceExpectationCode: 'B1.7',
    dimension: 'transfer',
    itemFamilyId: 'equiv-g3-transfer-thirds',
    representation: 'set-model',
    prompt: 'New sharing picture, no hints: is 3/6 the same amount as 1/2 of the same-size whole?',
    options: [opt('t', 'Yes', true), opt('f', 'No', false)],
  },
];

export const EQUIV_PROBES_G3: readonly ConceptualProbe[] = RAW_EQUIV_G3.map(stamp);

/** Grade 5 — equivalence with proper fractions (Ontario B1.3, subset; 2/3 = 4/6). */
const RAW_EQUIV_G5: readonly RawProbe[] = [
  {
    probeId: 'PR-FR-equiv-model-G5',
    skillId: 'SK-FR-equiv',
    gradeTarget: 5,
    sourceExpectationCode: 'B1.3',
    dimension: 'model',
    itemFamilyId: 'equiv-g5-model-twothirds',
    representation: 'area-model',
    prompt: 'Which bars show 2/3 and 4/6 as equal-width parts of the same-size whole?',
    options: [
      opt(
        'a',
        'A bar in 3 equal parts with 2 shaded, and a bar in 6 equal parts with 4 shaded',
        true,
      ),
      opt(
        'b',
        'A bar in 3 equal parts with 2 shaded, and a bar in 6 UNEQUAL parts with 4 shaded',
        false,
        'MC-FR-unequal-parts',
      ),
      opt(
        'c',
        'A short bar and a long bar, each with some parts shaded',
        false,
        'MC-FR-different-wholes',
      ),
    ],
  },
  {
    probeId: 'PR-FR-equiv-value-G5',
    skillId: 'SK-FR-equiv',
    gradeTarget: 5,
    sourceExpectationCode: 'B1.3',
    dimension: 'value',
    itemFamilyId: 'equiv-g5-value-twothirds',
    representation: 'symbolic',
    prompt: 'Is 2/3 equal to 4/6?',
    options: [opt('t', 'Yes', true), opt('f', 'No', false)],
  },
  {
    probeId: 'PR-FR-equiv-reason-G5',
    skillId: 'SK-FR-equiv',
    gradeTarget: 5,
    sourceExpectationCode: 'B1.3',
    dimension: 'reasoning',
    itemFamilyId: 'equiv-g5-reason-twothirds',
    representation: 'symbolic',
    prompt: 'How do you get 4/6 from 2/3 as an equal fraction?',
    options: [
      opt('a', 'Multiply the number of parts and the parts taken both by 2 (2×2 / 3×2)', true),
      opt(
        'b',
        'Multiply only the bottom number by 2 (keep the top the same)',
        false,
        'MC-FR-equiv-scale-one',
      ),
      opt('c', 'Add 2 to the top and 2 to the bottom', false, 'MC-FR-equiv-scale-one'),
    ],
  },
  {
    probeId: 'PR-FR-equiv-transfer-G5',
    skillId: 'SK-FR-equiv',
    gradeTarget: 5,
    sourceExpectationCode: 'B1.3',
    dimension: 'transfer',
    itemFamilyId: 'equiv-g5-transfer-threequarters',
    representation: 'number-line',
    prompt: 'New problem on a number line, no hints: is 3/4 equal to 6/8?',
    options: [opt('t', 'Yes', true), opt('f', 'No', false)],
  },
];

export const EQUIV_PROBES_G5: readonly ConceptualProbe[] = RAW_EQUIV_G5.map(stamp);

/** Grade 4 — equivalence (Ontario B1.9; 2/4 = 1/2). */
const RAW_EQUIV_G4: readonly RawProbe[] = [
  {
    probeId: 'PR-FR-equiv-model-G4',
    skillId: 'SK-FR-equiv',
    gradeTarget: 4,
    sourceExpectationCode: 'B1.9',
    dimension: 'model',
    itemFamilyId: 'equiv-g4-model-half',
    representation: 'area-model',
    prompt: 'Which bars show 2/4 and 1/2 as equal parts of the same-size whole?',
    options: [
      opt(
        'a',
        'A bar in 4 equal parts with 2 shaded, and a bar in 2 equal parts with 1 shaded',
        true,
      ),
      opt(
        'b',
        'A bar in 4 UNEQUAL parts with 2 shaded, and a bar in 2 equal parts',
        false,
        'MC-FR-unequal-parts',
      ),
      opt('c', 'A long bar and a short bar, each partly shaded', false, 'MC-FR-different-wholes'),
    ],
  },
  {
    probeId: 'PR-FR-equiv-value-G4',
    skillId: 'SK-FR-equiv',
    gradeTarget: 4,
    sourceExpectationCode: 'B1.9',
    dimension: 'value',
    itemFamilyId: 'equiv-g4-value-half',
    representation: 'symbolic',
    prompt: 'Is 2/4 equal to 1/2?',
    options: [opt('t', 'Yes', true), opt('f', 'No', false)],
  },
  {
    probeId: 'PR-FR-equiv-reason-G4',
    skillId: 'SK-FR-equiv',
    gradeTarget: 4,
    sourceExpectationCode: 'B1.9',
    dimension: 'reasoning',
    itemFamilyId: 'equiv-g4-reason-half',
    representation: 'area-model',
    prompt: 'Why are 2/4 and 1/2 equal?',
    options: [
      opt(
        'a',
        '2 of 4 equal parts covers the same amount as 1 of 2 equal parts of the same whole',
        true,
      ),
      opt('b', 'Because 2 is half of 4', false, 'MC-FR-equiv-scale-one'),
      opt('c', 'Because both have parts shaded', false, 'MC-FR-different-wholes'),
    ],
  },
  {
    probeId: 'PR-FR-equiv-transfer-G4',
    skillId: 'SK-FR-equiv',
    gradeTarget: 4,
    sourceExpectationCode: 'B1.9',
    dimension: 'transfer',
    itemFamilyId: 'equiv-g4-transfer-sixths',
    representation: 'number-line',
    prompt: 'New problem on a number line, no hints: is 3/6 equal to 1/2?',
    options: [opt('t', 'Yes', true), opt('f', 'No', false)],
  },
];
export const EQUIV_PROBES_G4: readonly ConceptualProbe[] = RAW_EQUIV_G4.map(stamp);

/** Grade 3 — comparison in a fair-sharing context (Ontario B1.8; 1/4 vs 1/8). */
const RAW_COMPARE_G3: readonly RawProbe[] = [
  {
    probeId: 'PR-FR-compare-model-G3',
    skillId: 'SK-FR-compare',
    gradeTarget: 3,
    sourceExpectationCode: 'B1.8',
    dimension: 'model',
    itemFamilyId: 'compare-g3-model-unit',
    representation: 'area-model',
    prompt:
      'Two SAME-size wholes: one shared fairly by 4, one by 8. Which picture splits each into equal parts?',
    options: [
      opt('a', 'One whole in 4 equal parts, the other in 8 equal parts', true),
      opt('b', 'One whole in 4 unequal parts', false, 'MC-FR-unequal-parts'),
      opt(
        'c',
        'A big whole shared by 4 and a small whole shared by 8',
        false,
        'MC-FR-different-wholes',
      ),
    ],
  },
  {
    probeId: 'PR-FR-compare-value-G3',
    skillId: 'SK-FR-compare',
    gradeTarget: 3,
    sourceExpectationCode: 'B1.8',
    dimension: 'value',
    itemFamilyId: 'compare-g3-value-unit',
    representation: 'area-model',
    prompt: 'Which is the bigger share of the same-size whole: 1/4 or 1/8?',
    options: [
      opt('a', '1/4 is bigger', true),
      opt('b', '1/8 is bigger', false, 'MC-FR-denom-size'),
      opt('c', 'They are equal', false),
    ],
  },
  {
    probeId: 'PR-FR-compare-reason-G3',
    skillId: 'SK-FR-compare',
    gradeTarget: 3,
    sourceExpectationCode: 'B1.8',
    dimension: 'reasoning',
    itemFamilyId: 'compare-g3-reason-unit',
    representation: 'area-model',
    prompt: 'Why is 1/4 bigger than 1/8?',
    options: [
      opt('a', 'When the same whole is split into fewer equal parts, each part is bigger', true),
      opt('b', 'Because 8 is more than 4, so 1/8 is bigger', false, 'MC-FR-denom-size'),
      opt('c', 'Because the wholes are different sizes', false, 'MC-FR-different-wholes'),
    ],
  },
  {
    probeId: 'PR-FR-compare-transfer-G3',
    skillId: 'SK-FR-compare',
    gradeTarget: 3,
    sourceExpectationCode: 'B1.8',
    dimension: 'transfer',
    itemFamilyId: 'compare-g3-transfer-thirds',
    representation: 'set-model',
    prompt: 'New sharing problem, no hints: which is bigger, 1/3 or 1/6?',
    options: [
      opt('a', '1/3', true),
      opt('b', '1/6', false, 'MC-FR-denom-size'),
      opt('c', 'equal', false),
    ],
  },
];
export const COMPARE_PROBES_G3: readonly ConceptualProbe[] = RAW_COMPARE_G3.map(stamp);

/** Grade 4 — comparison from fair-share scenarios (Ontario B1.5; 2/4 vs 2/8). */
const RAW_COMPARE_G4: readonly RawProbe[] = [
  {
    probeId: 'PR-FR-compare-model-G4',
    skillId: 'SK-FR-compare',
    gradeTarget: 4,
    sourceExpectationCode: 'B1.5',
    dimension: 'model',
    itemFamilyId: 'compare-g4-model',
    representation: 'area-model',
    prompt: 'Which shows 2/4 and 2/8 as equal parts of the SAME-size whole?',
    options: [
      opt('a', 'A bar in 4 equal parts (2 shaded) and a bar in 8 equal parts (2 shaded)', true),
      opt('b', 'A bar in 8 unequal parts with 2 shaded', false, 'MC-FR-unequal-parts'),
      opt('c', 'Two different-sized bars', false, 'MC-FR-different-wholes'),
    ],
  },
  {
    probeId: 'PR-FR-compare-value-G4',
    skillId: 'SK-FR-compare',
    gradeTarget: 4,
    sourceExpectationCode: 'B1.5',
    dimension: 'value',
    itemFamilyId: 'compare-g4-value',
    representation: 'symbolic',
    prompt: 'Which is bigger: 2/4 or 2/8?',
    options: [
      opt('a', '2/4', true),
      opt('b', '2/8', false, 'MC-FR-denom-size'),
      opt('c', 'equal', false),
    ],
  },
  {
    probeId: 'PR-FR-compare-reason-G4',
    skillId: 'SK-FR-compare',
    gradeTarget: 4,
    sourceExpectationCode: 'B1.5',
    dimension: 'reasoning',
    itemFamilyId: 'compare-g4-reason',
    representation: 'area-model',
    prompt: 'Why is 2/4 bigger than 2/8?',
    options: [
      opt(
        'a',
        'Both take 2 pieces, but fourths are bigger pieces than eighths of the same whole',
        true,
      ),
      opt('b', 'Because 8 is bigger than 4', false, 'MC-FR-denom-size'),
      opt('c', 'Because they both have a 2 on top', false, 'MC-FR-whole-number-compare'),
    ],
  },
  {
    probeId: 'PR-FR-compare-transfer-G4',
    skillId: 'SK-FR-compare',
    gradeTarget: 4,
    sourceExpectationCode: 'B1.5',
    dimension: 'transfer',
    itemFamilyId: 'compare-g4-transfer',
    representation: 'number-line',
    prompt: 'New pair, no hints: which is bigger, 2/3 or 2/6?',
    options: [
      opt('a', '2/3', true),
      opt('b', '2/6', false, 'MC-FR-denom-size'),
      opt('c', 'equal', false),
    ],
  },
];
export const COMPARE_PROBES_G4: readonly ConceptualProbe[] = RAW_COMPARE_G4.map(stamp);

/** Grade 5 — comparison, proper fractions with unlike denominators (Ontario B1.4 subset; 3/4 vs 5/8). */
const RAW_COMPARE_G5: readonly RawProbe[] = [
  {
    probeId: 'PR-FR-compare-model-G5',
    skillId: 'SK-FR-compare',
    gradeTarget: 5,
    sourceExpectationCode: 'B1.4',
    dimension: 'model',
    itemFamilyId: 'compare-g5-model',
    representation: 'number-line',
    prompt: 'Which number line correctly places 3/4 and 5/8 on the same 0–1 line?',
    options: [
      opt('a', '3/4 at the 6/8 mark and 5/8 at the 5/8 mark', true),
      opt(
        'b',
        '3/4 and 5/8 placed by numerator only (3 before 5)',
        false,
        'MC-FR-whole-number-compare',
      ),
      opt('c', 'Two number lines of different lengths', false, 'MC-FR-different-wholes'),
    ],
  },
  {
    probeId: 'PR-FR-compare-value-G5',
    skillId: 'SK-FR-compare',
    gradeTarget: 5,
    sourceExpectationCode: 'B1.4',
    dimension: 'value',
    itemFamilyId: 'compare-g5-value',
    representation: 'symbolic',
    prompt: 'Which is bigger: 3/4 or 5/8?',
    options: [
      opt('a', '3/4', true),
      opt('b', '5/8', false, 'MC-FR-whole-number-compare'),
      opt('c', 'equal', false),
    ],
  },
  {
    probeId: 'PR-FR-compare-reason-G5',
    skillId: 'SK-FR-compare',
    gradeTarget: 5,
    sourceExpectationCode: 'B1.4',
    dimension: 'reasoning',
    itemFamilyId: 'compare-g5-reason',
    representation: 'symbolic',
    prompt: 'How do you know 3/4 is bigger than 5/8?',
    options: [
      opt('a', 'Rewrite 3/4 as 6/8; 6 eighths is more than 5 eighths', true),
      opt(
        'b',
        '5/8 is bigger because 5 and 8 are bigger numbers',
        false,
        'MC-FR-whole-number-compare',
      ),
      opt('c', '3/4 is smaller because eighths are smaller pieces', false, 'MC-FR-denom-size'),
    ],
  },
  {
    probeId: 'PR-FR-compare-transfer-G5',
    skillId: 'SK-FR-compare',
    gradeTarget: 5,
    sourceExpectationCode: 'B1.4',
    dimension: 'transfer',
    itemFamilyId: 'compare-g5-transfer',
    representation: 'area-model',
    prompt: 'New unlike-denominator pair, no hints: which is bigger, 2/3 or 3/5?',
    options: [
      opt('a', '2/3', true),
      opt('b', '3/5', false, 'MC-FR-whole-number-compare'),
      opt('c', 'equal', false),
    ],
  },
];
export const COMPARE_PROBES_G5: readonly ConceptualProbe[] = RAW_COMPARE_G5.map(stamp);

export const CONCEPTUAL_PROBES: readonly ConceptualProbe[] = [
  ...EQUIV_PROBES_G3,
  ...EQUIV_PROBES_G4,
  ...EQUIV_PROBES_G5,
  ...COMPARE_PROBES_G3,
  ...COMPARE_PROBES_G4,
  ...COMPARE_PROBES_G5,
];

export interface ProbeScore {
  readonly correct: boolean;
  readonly misconceptionId?: string;
}

/** Deterministically score a single-selection probe response. */
export function scoreProbe(probe: ConceptualProbe, chosenOptionId: string): ProbeScore {
  const chosen = probe.options.find((o) => o.id === chosenOptionId);
  if (!chosen) return { correct: false };
  return chosen.correct
    ? { correct: true }
    : { correct: false, misconceptionId: chosen.misconceptionId };
}
