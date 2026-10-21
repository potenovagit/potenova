/** The four conceptual evidence dimensions (mirrors learner-state's
 *  EvidenceDimension; kept local so content does not depend on learner-state). */
export type EvidenceDimension = 'model' | 'value' | 'reasoning' | 'transfer';

/**
 * DRAFT grade-calibrated conceptual probes — equivalence and comparison, Grades
 * 3–5 (educator Stage-1 Annex B). These demonstrate the model / value /
 * reasoning / transfer assessment for the educator to EXAMINE; they are NOT
 * approved content.
 *
 * ============================================================================
 *  DRAFT / UNSIGNED (revision 0.2). Distractors, reasoning options and
 *  grade-specific wording are the educator's to author and approve — these are
 *  scaffolds from the Stage-1 spec so the behaviour can be shown running on
 *  synthetic data. Nothing here reaches a child before G2. `approved: false`
 *  marks every probe.
 * ============================================================================
 *
 * Revision 0.2 applies the six content corrections from the educator's
 * 2026-10-20 review:
 *   1. Correct option is no longer always first in source, AND delivery goes
 *      through `toChildFacing()`, which strips the `correct`/`misconceptionId`
 *      labels a child must never see and shuffles option order deterministically
 *      by seed.
 *   2. Equivalence TRANSFER items are no longer uniformly "Yes": they mix
 *      genuine equivalences and genuine non-equivalences across distinct
 *      families (thirds/sixths, fifths, quarters/thirds).
 *   3. MODEL-dimension options carry a `visual` spec so the renderer draws
 *      actual alternative bar models to choose between, not a text description.
 *   4. The Grade-4 reasoning distractor "Because 2 is half of 4" (valid but
 *      incomplete) is replaced by an unambiguous additive-error distractor.
 *   5. The Grade-5 model wording no longer implies thirds and sixths are the
 *      same width — it says the parts WITHIN each whole are equal.
 *   6. Grade-3 items use an authentic fair-sharing problem context, not a bare
 *      reference to "sharing".
 *
 * All scoring is deterministic single-selection: the child chooses one option.
 * A wrong `reasoning` (or transfer) choice is tagged with the misconception it
 * reveals, so the engine can both withhold mastery and route remediation.
 */

/** One partitioned whole in an option's picture. */
export interface WholeSpec {
  /** Number of partitions drawn. */
  readonly parts: number;
  /** How many partitions are shaded. */
  readonly shaded: number;
  /** Whether the partitions are drawn as EQUAL widths (false = a distractor
   *  showing unequal parts). */
  readonly equalParts: boolean;
  /** Relative width of this whole (1 = reference). Values ≠ 1 across wholes in
   *  one option depict different-size wholes — a `different-wholes` distractor. */
  readonly widthScale?: number;
}

/** A drawable model for a MODEL-dimension option, so the child chooses between
 *  actual alternative pictures rather than reading a description of each. */
export interface OptionVisual {
  readonly kind: 'bars';
  readonly wholes: readonly WholeSpec[];
}

export interface ProbeOption {
  readonly id: string;
  readonly text: string;
  readonly correct: boolean;
  /** For an incorrect option: the misconception it reveals (coaching + diagnosis). */
  readonly misconceptionId?: string;
  /** Model-dimension options carry a picture to render (correction #3). */
  readonly visual?: OptionVisual;
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

const REF = 'CONCEPTUAL-PROBE-DRAFT-0.2(ER-CONTENT-UNCALIBRATED)';
const opt = (
  id: string,
  text: string,
  correct: boolean,
  misconceptionId?: string,
  visual?: OptionVisual,
): ProbeOption => ({
  id,
  text,
  correct,
  ...(misconceptionId ? { misconceptionId } : {}),
  ...(visual ? { visual } : {}),
});
/** Shorthand builders for option visuals. */
const bars = (...wholes: WholeSpec[]): OptionVisual => ({ kind: 'bars', wholes });
const whole = (
  parts: number,
  shaded: number,
  equalParts = true,
  widthScale?: number,
): WholeSpec => ({
  parts,
  shaded,
  equalParts,
  ...(widthScale !== undefined ? { widthScale } : {}),
});

type RawProbe = Omit<ConceptualProbe, 'approved' | 'approvalRef'>;
const stamp = (p: RawProbe): ConceptualProbe => ({ ...p, approved: false, approvalRef: REF });

/** Grade 3 — equivalence in an authentic fair-sharing story (Ontario B1.7).
 *  Mia and Jon have same-size granola bars; 1/2 vs 2/4. */
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
      'Mia and Jon each have a granola bar that is exactly the same size. Mia wants to break hers into 2 fair (equal) pieces and Jon wants to break his into 4 fair (equal) pieces. Which picture shows BOTH bars broken into fair pieces?',
    options: [
      // correct is NOT first (correction #1)
      opt(
        'b',
        'Mia’s bar in 2 pieces that are not the same size',
        false,
        'MC-FR-unequal-parts',
        bars(whole(2, 1, false)),
      ),
      opt(
        'a',
        'Mia’s bar in 2 equal pieces and Jon’s bar in 4 equal pieces',
        true,
        undefined,
        bars(whole(2, 1, true), whole(4, 2, true)),
      ),
      opt(
        'c',
        'A big bar for Mia and a small bar for Jon, each cut in half',
        false,
        'MC-FR-different-wholes',
        bars(whole(2, 1, true, 1.4), whole(2, 1, true, 0.6)),
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
    prompt:
      'Mia eats 1 of her 2 equal pieces (1/2 of her bar). Jon eats 2 of his 4 equal pieces (2/4 of his bar). Did Mia and Jon eat the same amount of granola?',
    options: [
      opt('f', 'No, they ate different amounts', false, 'MC-FR-equiv-missed'),
      opt('t', 'Yes, they ate the same amount', true),
    ],
  },
  {
    probeId: 'PR-FR-equiv-reason-G3',
    skillId: 'SK-FR-equiv',
    gradeTarget: 3,
    sourceExpectationCode: 'B1.7',
    dimension: 'reasoning',
    itemFamilyId: 'equiv-g3-reason-half',
    representation: 'area-model',
    prompt: 'Mia ate 1/2 and Jon ate 2/4 of the same-size bar. Why did they eat the same amount?',
    options: [
      opt('b', 'Because 2 and 4 are both even numbers', false, 'MC-FR-surface-feature'),
      opt(
        'a',
        'The two amounts cover the same part of the same-size bar — Jon’s bar is just cut into more pieces',
        true,
      ),
      opt('c', 'Because both of them ate some of their bar', false, 'MC-FR-surface-feature'),
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
    // genuine equivalence, NEW family (thirds/sixths) — mix with the non-equivalent G4/G5 (correction #2)
    prompt:
      'A new, different problem (no hints): Sam cuts an identical bar into 3 equal pieces and eats 1 (1/3). Pat cuts an identical bar into 6 equal pieces and eats 2 (2/6). Did Sam and Pat eat the same amount?',
    options: [
      opt('t', 'Yes, the same amount', true),
      opt('f', 'No, different amounts', false, 'MC-FR-equiv-missed'),
    ],
  },
];

export const EQUIV_PROBES_G3: readonly ConceptualProbe[] = RAW_EQUIV_G3.map(stamp);

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
    prompt: 'Which picture shows 2/4 and 1/2 as equal parts of two bars that are the same size?',
    options: [
      opt(
        'b',
        'A bar cut into 4 parts that are NOT equal, with 2 shaded, next to a bar in 2 equal parts',
        false,
        'MC-FR-unequal-parts',
        bars(whole(4, 2, false), whole(2, 1, true)),
      ),
      opt(
        'c',
        'A long bar and a short bar, each partly shaded',
        false,
        'MC-FR-different-wholes',
        bars(whole(4, 2, true, 1.4), whole(2, 1, true, 0.6)),
      ),
      opt(
        'a',
        'A bar in 4 equal parts with 2 shaded, and a same-size bar in 2 equal parts with 1 shaded',
        true,
        undefined,
        bars(whole(4, 2, true), whole(2, 1, true)),
      ),
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
    options: [opt('t', 'Yes', true), opt('f', 'No', false, 'MC-FR-equiv-missed')],
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
        '2 of 4 equal parts covers the same amount as 1 of 2 equal parts of the same-size whole',
        true,
      ),
      // correction #4: replace the valid-but-incomplete "2 is half of 4" with an
      // unambiguous additive error (adding to top and bottom of 1/2 to make 2/4).
      opt(
        'b',
        'Because you add 1 to the top and 2 to the bottom of 1/2 to get 2/4',
        false,
        'MC-FR-equiv-additive',
      ),
      opt(
        'c',
        'Because both fractions are written with even numbers',
        false,
        'MC-FR-surface-feature',
      ),
    ],
  },
  {
    probeId: 'PR-FR-equiv-transfer-G4',
    skillId: 'SK-FR-equiv',
    gradeTarget: 4,
    sourceExpectationCode: 'B1.9',
    dimension: 'transfer',
    itemFamilyId: 'equiv-g4-transfer-fifths',
    representation: 'number-line',
    // genuine NON-equivalence, new family (fifths) — answer is "No" (correction #2)
    prompt: 'A new, different problem on a number line (no hints): is 2/5 equal to 1/2?',
    options: [opt('f', 'No', true), opt('t', 'Yes', false, 'MC-FR-nonequiv-assumed')],
  },
];
export const EQUIV_PROBES_G4: readonly ConceptualProbe[] = RAW_EQUIV_G4.map(stamp);

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
    // correction #5: wording makes clear the parts WITHIN each bar are equal,
    // and the two bars are the same overall size — NOT that thirds and sixths
    // are the same width.
    prompt:
      'Two bars are the same size. In the first, all the parts are equal and 2/3 is shaded. In the second, all the parts are equal and 4/6 is shaded. Which picture is correct?',
    options: [
      opt(
        'b',
        'First bar in 3 equal parts (2 shaded); second bar in 6 parts that are NOT equal (4 shaded)',
        false,
        'MC-FR-unequal-parts',
        bars(whole(3, 2, true), whole(6, 4, false)),
      ),
      opt(
        'a',
        'First bar in 3 equal parts (2 shaded); second, same-size bar in 6 equal parts (4 shaded)',
        true,
        undefined,
        bars(whole(3, 2, true), whole(6, 4, true)),
      ),
      opt(
        'c',
        'A short bar and a long bar, each with equal parts and some shaded',
        false,
        'MC-FR-different-wholes',
        bars(whole(3, 2, true, 0.6), whole(6, 4, true, 1.4)),
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
    options: [opt('f', 'No', false, 'MC-FR-equiv-missed'), opt('t', 'Yes', true)],
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
      opt(
        'b',
        'Multiply only the bottom number by 2 and keep the top the same',
        false,
        'MC-FR-equiv-scale-one',
      ),
      opt('a', 'Multiply BOTH the top and the bottom by 2 (2×2 over 3×2)', true),
      opt('c', 'Add 2 to the top and 2 to the bottom', false, 'MC-FR-equiv-additive'),
    ],
  },
  {
    probeId: 'PR-FR-equiv-transfer-G5',
    skillId: 'SK-FR-equiv',
    gradeTarget: 5,
    sourceExpectationCode: 'B1.3',
    dimension: 'transfer',
    itemFamilyId: 'equiv-g5-transfer-quarters-thirds',
    representation: 'number-line',
    // genuine NON-equivalence, new family — answer is "No" (correction #2)
    prompt: 'A new, different problem on a number line (no hints): is 2/3 equal to 3/4?',
    options: [opt('t', 'Yes', false, 'MC-FR-nonequiv-assumed'), opt('f', 'No', true)],
  },
];

export const EQUIV_PROBES_G5: readonly ConceptualProbe[] = RAW_EQUIV_G5.map(stamp);

/** Grade 3 — comparison in an authentic fair-sharing story (Ontario B1.8).
 *  Two identical pizzas, one shared by 4 and one by 8; 1/4 vs 1/8. */
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
      'Two pizzas are exactly the same size. One is shared fairly among 4 children and the other fairly among 8 children. Which picture shows BOTH pizzas shared into fair (equal) pieces?',
    options: [
      opt(
        'b',
        'The first pizza cut into 4 pieces that are not the same size',
        false,
        'MC-FR-unequal-parts',
        bars(whole(4, 1, false)),
      ),
      opt(
        'c',
        'A big pizza shared by 4 and a small pizza shared by 8',
        false,
        'MC-FR-different-wholes',
        bars(whole(4, 1, true, 1.4), whole(8, 1, true, 0.6)),
      ),
      opt(
        'a',
        'The first pizza in 4 equal pieces and the second, same-size pizza in 8 equal pieces',
        true,
        undefined,
        bars(whole(4, 1, true), whole(8, 1, true)),
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
    prompt:
      'You take 1 slice from the pizza shared among 4 (that is 1/4). Your friend takes 1 slice from the pizza shared among 8 (that is 1/8). Who gets more pizza?',
    options: [
      opt('b', 'Your friend, because 1/8 is bigger', false, 'MC-FR-denom-size'),
      opt('a', 'You do, because 1/4 is bigger', true),
      opt('c', 'You both get the same', false, 'MC-FR-equiv-missed'),
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
    prompt: 'Why is 1 slice of the pizza shared by 4 bigger than 1 slice of the pizza shared by 8?',
    options: [
      opt('b', 'Because 8 is more than 4, so 1/8 must be bigger', false, 'MC-FR-denom-size'),
      opt(
        'a',
        'When the same-size pizza is shared among fewer children, each fair slice is bigger',
        true,
      ),
      opt('c', 'Because the two pizzas are different sizes', false, 'MC-FR-different-wholes'),
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
    prompt:
      'A new, different problem (no hints): one identical cake is shared fairly among 3 friends and another among 6 friends. Is one slice of the cake shared by 3 bigger, smaller, or the same as one slice of the cake shared by 6?',
    options: [
      opt('a', 'Bigger', true),
      opt('b', 'Smaller', false, 'MC-FR-denom-size'),
      opt('c', 'The same', false, 'MC-FR-equiv-missed'),
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
    prompt: 'Which picture shows 2/4 and 2/8 as equal parts of two bars that are the same size?',
    options: [
      opt(
        'b',
        'A bar in 8 parts that are not equal, with 2 shaded',
        false,
        'MC-FR-unequal-parts',
        bars(whole(8, 2, false)),
      ),
      opt(
        'a',
        'A bar in 4 equal parts (2 shaded) and a same-size bar in 8 equal parts (2 shaded)',
        true,
        undefined,
        bars(whole(4, 2, true), whole(8, 2, true)),
      ),
      opt(
        'c',
        'Two bars of different sizes, each partly shaded',
        false,
        'MC-FR-different-wholes',
        bars(whole(4, 2, true, 1.4), whole(8, 2, true, 0.6)),
      ),
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
      opt('b', '2/8', false, 'MC-FR-denom-size'),
      opt('a', '2/4', true),
      opt('c', 'They are equal', false, 'MC-FR-equiv-missed'),
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
        'Both take 2 pieces, but fourths are bigger pieces than eighths of the same-size whole',
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
    prompt: 'A new, different pair (no hints): which is bigger, 2/3 or 2/6?',
    options: [
      opt('b', '2/6', false, 'MC-FR-denom-size'),
      opt('a', '2/3', true),
      opt('c', 'They are equal', false, 'MC-FR-equiv-missed'),
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
      opt(
        'b',
        '3/4 and 5/8 placed by their top number only (3 before 5)',
        false,
        'MC-FR-whole-number-compare',
      ),
      opt('a', '3/4 at the 6/8 mark and 5/8 at the 5/8 mark', true),
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
      opt('c', 'They are equal', false, 'MC-FR-equiv-missed'),
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
      opt(
        'b',
        '5/8 is bigger because 5 and 8 are bigger numbers',
        false,
        'MC-FR-whole-number-compare',
      ),
      opt('c', '3/4 is smaller because eighths are smaller pieces', false, 'MC-FR-denom-size'),
      opt('a', 'Rewrite 3/4 as 6/8; 6 eighths is more than 5 eighths', true),
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
    prompt: 'A new, different unlike-denominator pair (no hints): which is bigger, 2/3 or 3/5?',
    options: [
      opt('a', '2/3', true),
      opt('b', '3/5', false, 'MC-FR-whole-number-compare'),
      opt('c', 'They are equal', false, 'MC-FR-equiv-missed'),
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

/**
 * The child-facing view of an option: id, text and (for model probes) the
 * picture. The `correct` flag and the `misconceptionId` — which a learner must
 * NEVER see — are omitted by construction (correction #1).
 */
export interface PublicProbeOption {
  readonly id: string;
  readonly text: string;
  readonly visual?: OptionVisual;
}

export interface ChildFacingProbe {
  readonly probeId: string;
  readonly gradeTarget: number;
  readonly dimension: EvidenceDimension;
  readonly representation: string;
  readonly prompt: string;
  readonly options: readonly PublicProbeOption[];
}

/** Small deterministic string hash (FNV-1a 32-bit) for seeded shuffling. */
function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Project a probe to its child-facing form: strip correctness labels and shuffle
 * the option order deterministically from `seed` (so a correct answer is never
 * positionally predictable, yet the evidence pack stays reproducible).
 */
export function toChildFacing(probe: ConceptualProbe, seed: string): ChildFacingProbe {
  const indexed = probe.options.map((o, i) => ({ o, i }));
  // deterministic key per option from the seed + option id
  indexed.sort((a, b) => {
    const ka = hash32(`${seed}:${probe.probeId}:${a.o.id}`);
    const kb = hash32(`${seed}:${probe.probeId}:${b.o.id}`);
    return ka === kb ? a.i - b.i : ka - kb;
  });
  return {
    probeId: probe.probeId,
    gradeTarget: probe.gradeTarget,
    dimension: probe.dimension,
    representation: probe.representation,
    prompt: probe.prompt,
    options: indexed.map(({ o }) => ({
      id: o.id,
      text: o.text,
      ...(o.visual ? { visual: o.visual } : {}),
    })),
  };
}
