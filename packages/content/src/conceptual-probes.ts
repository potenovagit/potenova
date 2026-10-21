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

export const CONCEPTUAL_PROBES: readonly ConceptualProbe[] = [
  ...EQUIV_PROBES_G3,
  ...EQUIV_PROBES_G5,
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
