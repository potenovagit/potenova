/**
 * Teaching library (LRN "Learn it" / step-by-step): authored, approved worked
 * explanations keyed by (skillId, misconceptionId, representation).
 *
 * These are AUTHORED curriculum content — not model-generated — so, like the
 * coaching hints, they are approved assets that may be surfaced to a child
 * directly; they never pass a free-form tutor turn through. The content gate's
 * trust rule still applies in spirit: a lesson is servable only when it is
 * `approved` AND carries a signed `approvalRef`. Selection returns ONLY such
 * lessons, so nothing unapproved can reach a child.
 *
 * Personalisation is by SELECTION, never generation: the engine picks the most
 * specific approved lesson for the child's just-shown misconception and (when
 * known) their representation, falling back to the skill's generic default. The
 * child is never shown content minted for them on the fly.
 *
 * Steps are STRUCTURED data (not raw HTML/markup), so the renderer draws them
 * safely and the content stays reviewable field-by-field.
 *
 * NOTE: the bar that makes a lesson "approved" for a real child is an
 * EVIDENCE-REQUIRED decision with an owner and gate; the seed below is authored
 * DRAFT content for synthetic Stage-2 only (`approvalRef` marks it as such).
 */

/** The special key value meaning "applies regardless of this dimension". */
export const ANY = 'any' as const;

export type LessonStep =
  | { readonly kind: 'say'; readonly text: string }
  | {
      readonly kind: 'bars';
      readonly label: string;
      readonly filled: number;
      readonly total: number;
    };

export interface Lesson {
  readonly lessonId: string;
  readonly skillId: string;
  /** A misconception id this lesson counters, or ANY for the skill default. */
  readonly misconceptionId: string;
  /** A representation this lesson teaches in, or ANY for any representation. */
  readonly representation: string;
  readonly approved: boolean;
  /** Signed approval-record ref — required for a lesson to be servable. */
  readonly approvalRef: string | null;
  readonly version: string;
  readonly title: string;
  readonly intro: string;
  readonly steps: readonly LessonStep[];
  readonly takeaway: string;
}

const V = 'lessons-DRAFT-0.1';
/** DRAFT approval marker — a real child-facing sign-off is EVIDENCE REQUIRED. */
const REF = 'AUTHORED-DRAFT-0.1(ER-CONTENT-UNCALIBRATED)';

export const LESSONS: readonly Lesson[] = [
  // Comparing fractions — the "larger denominator = larger fraction" misconception,
  // taught with an area/bar model (the same-bottom trick).
  {
    lessonId: 'LS-FR-compare-denom-bars',
    skillId: 'SK-FR-compare',
    misconceptionId: 'MC-FR-denom-size',
    representation: 'area-model',
    approved: true,
    approvalRef: REF,
    version: V,
    title: 'Comparing fractions',
    intro:
      'The trick: give both fractions the same bottom number, then the bigger top wins. Compare 1/2 and 2/5 using tenths.',
    steps: [
      { kind: 'bars', label: '1/2 = 5/10', filled: 5, total: 10 },
      { kind: 'bars', label: '2/5 = 4/10', filled: 4, total: 10 },
      { kind: 'say', text: 'Now both are in tenths, so just compare the tops: 5 and 4.' },
    ],
    takeaway: '5 tenths beats 4 tenths — so 1/2 is larger.',
  },
  // Comparing fractions — generic default (any misconception / any representation).
  {
    lessonId: 'LS-FR-compare-default',
    skillId: 'SK-FR-compare',
    misconceptionId: ANY,
    representation: ANY,
    approved: true,
    approvalRef: REF,
    version: V,
    title: 'Comparing fractions',
    intro: 'To compare two fractions, make their bottoms match, then compare the tops.',
    steps: [
      { kind: 'say', text: 'Find a bottom number both fractions can share.' },
      { kind: 'say', text: 'Rewrite each fraction with that shared bottom.' },
      { kind: 'say', text: 'The one with the bigger top is larger.' },
    ],
    takeaway: 'Same bottoms → compare the tops.',
  },
  // Equivalent fractions — generic default.
  {
    lessonId: 'LS-FR-equiv-default',
    skillId: 'SK-FR-equiv',
    misconceptionId: ANY,
    representation: ANY,
    approved: true,
    approvalRef: REF,
    version: V,
    title: 'Equivalent fractions',
    intro: 'Two fractions are equivalent when they cover the same amount of the whole.',
    steps: [
      { kind: 'bars', label: '1/2', filled: 5, total: 10 },
      { kind: 'bars', label: '5/10', filled: 5, total: 10 },
      {
        kind: 'say',
        text: 'Multiply the top and bottom by the same number to find an equal fraction.',
      },
    ],
    takeaway: 'Same shaded amount → the fractions are equal.',
  },
  // Adding within 20 — regrouping default.
  {
    lessonId: 'LS-NS-add20-default',
    skillId: 'SK-NS-add-within20',
    misconceptionId: ANY,
    representation: ANY,
    approved: true,
    approvalRef: REF,
    version: V,
    title: 'Adding within 20',
    intro: 'When a column goes past 10, carry the extra ten into the next column.',
    steps: [
      { kind: 'say', text: 'Add the ones first: 8 + 5 = 13.' },
      { kind: 'say', text: '13 is one ten and 3 ones — write the 3, carry the 1 ten.' },
      { kind: 'say', text: 'Add the tens, including the one you carried.' },
    ],
    takeaway: 'Past ten? Carry the ten, keep the ones.',
  },
  // Plurals: -es and -ies — generic default.
  {
    lessonId: 'LS-EN-sibilant-default',
    skillId: 'SK-EN-plural-sibilant',
    misconceptionId: ANY,
    representation: ANY,
    approved: true,
    approvalRef: REF,
    version: V,
    title: 'Tricky plurals',
    intro: 'Some words need more than a plain -s to sound right.',
    steps: [
      { kind: 'say', text: 'Words ending in s, x, z, ch or sh add -es: bus → buses, box → boxes.' },
      {
        kind: 'say',
        text: 'Words ending in a consonant + y change y to i and add -es: baby → babies.',
      },
    ],
    takeaway: 'Listen for the hiss or the -y: those take -es (or -ies).',
  },
];

export interface LessonQuery {
  readonly skillId: string;
  readonly misconceptionId?: string | null;
  readonly representation?: string | null;
}

/**
 * Pick the most specific SERVABLE lesson for a query. A lesson is a candidate
 * only when it is approved with a signed ref, its skill matches, and its
 * misconception is ANY or the requested one — a lesson for a *different*
 * misconception is never shown. Representation is a ranking signal, not a filter:
 * a lesson for the right misconception in another representation still beats the
 * generic default, so the misconception-specific lesson is chosen even when no
 * representation is supplied. Among candidates the most specific wins — a matched
 * misconception outranks a matched representation — with a deterministic tiebreak
 * by lessonId. Returns null when nothing is servable.
 */
export function selectLesson(q: LessonQuery, library: readonly Lesson[] = LESSONS): Lesson | null {
  const wantMis = q.misconceptionId ?? null;
  const wantRep = q.representation ?? null;

  const scored = library
    .filter((l) => l.approved && l.approvalRef !== null && l.skillId === q.skillId)
    // Misconception is a HARD filter — never show a lesson authored for a
    // different misconception. Representation is NOT: a lesson for the right
    // misconception in another representation still beats the generic default,
    // so representation only RANKS among same-misconception lessons.
    .filter((l) => l.misconceptionId === ANY || l.misconceptionId === wantMis)
    .map((l) => ({
      l,
      score:
        (l.misconceptionId !== ANY && l.misconceptionId === wantMis ? 2 : 0) +
        (l.representation !== ANY && l.representation === wantRep ? 1 : 0),
    }))
    .sort((a, b) => b.score - a.score || a.l.lessonId.localeCompare(b.l.lessonId));

  return scored[0]?.l ?? null;
}
