import type { AssistanceBand, EvidenceMode } from './evidence';

/**
 * Conceptual-mastery evaluation for the Grades 3–5 fractions beta (ER-03 candidate
 * policy v0.2; educator Stage-1 Annex A/B/E).
 *
 * ============================================================================
 *  EVIDENCE REQUIRED / CANDIDATE POLICY. The thresholds here are the educator's
 *  candidate values, approved only as a candidate policy subject to Stage-2
 *  calibration — NOT empirically validated child-release rules and NOT an
 *  independent Ontario-certified educator sign-off. Synthetic/non-prod only.
 * ============================================================================
 *
 * What this adds over the global DRAFT policy: mastery of a core assessed skill
 * (equivalence, comparison) is derived from FOUR distinct evidence DIMENSIONS,
 * not a single correct answer:
 *   - model     — valid equal-partition representation of the same whole
 *   - value     — the two fractions are the same quantity (the bare answer)
 *   - reasoning — WHY they are equal (chosen among misconception-based options)
 *   - transfer  — an uncoached new item (transfer_check mode), in a different
 *                 family; sequencing after reasoning is an instructional rule,
 *                 not a mastery gate (educator E4/R6)
 *
 * The property the educator asked to see demonstrated: a child who answers the
 * `value` correctly but the `reasoning` WRONG does NOT reach INDEPENDENT — a
 * correct final answer is not, by itself, evidence of conceptual understanding.
 * The evaluator reports WHICH requirements are unmet so the behaviour is legible.
 *
 * Only unaided (A0 / A1-neutral) evidence in an independent/transfer check counts;
 * assisted (A2+) and teaching-mode work never reach INDEPENDENT (AT-09). Counting
 * is on DISTINCT item families across ≥2 sessions and ≥2 representations, so a
 * repeated template or a single sitting cannot satisfy a dimension.
 */

export const EVIDENCE_DIMENSIONS = ['model', 'value', 'reasoning', 'transfer'] as const;
export type EvidenceDimension = (typeof EVIDENCE_DIMENSIONS)[number];

/** One dimension-tagged observation of a child's work (slice-local; the production
 *  ledger event is a superset — see evidence.ts). */
export interface ConceptualEvidence {
  readonly eventId: string;
  readonly skillId: string;
  readonly gradeTarget: number;
  readonly dimension: EvidenceDimension;
  readonly correct: boolean;
  readonly assistanceBand: AssistanceBand;
  readonly mode: EvidenceMode;
  readonly representation: string;
  /** Canonical item-family id — distinct families prevent double-counting a template. */
  readonly itemFamilyId: string;
  /** Explicit assessment-session id. When absent, a session is derived as the
   *  UTC calendar day of observedAt (educator note: sessions must be identifiable,
   *  not merely inferred — supply this in production). */
  readonly sessionId?: string;
  readonly observedAt: string; // ISO 8601
}

export interface ConceptualSkillPolicy {
  readonly skillId: string;
  readonly role: 'assessed-core' | 'on-ramp';
  /** Minimum distinct-family eligible correct events overall. */
  readonly minIndependent: number;
  /** Required eligible correct events per dimension (distinct families). */
  readonly dimensionQuota: Partial<Record<EvidenceDimension, number>>;
  readonly minSessions: number;
  readonly minRepresentations: number;
  readonly retentionDelayHours: number;
}

/** Bands that may count toward independence (A1 only when it is strictly
 *  non-cognitive; until the ledger records that distinguishably, treat A1 with
 *  care — see Stage-1 Annex C). A2+ never count. */
export const MASTERY_ELIGIBLE_BANDS: readonly AssistanceBand[] = ['A0', 'A1'];
/** Modes whose correct events may count toward INITIAL independence. Note that
 *  `retention_check` is deliberately NOT here: a delayed-retrieval check can
 *  confirm retention of an already-independent skill but can never, by itself,
 *  establish initial independence (educator R3). */
export const MASTERY_COUNTED_MODES: readonly EvidenceMode[] = [
  'independent_check',
  'transfer_check',
];
/** Modes whose correct unaided events may satisfy the POST-INDEPENDENCE
 *  retention gate. This is a superset of MASTERY_COUNTED_MODES: a real delayed
 *  check is recorded as `retention_check`, and it counts only here — never
 *  toward the initial requirements above (educator R3). Teaching/diagnostic
 *  modes are excluded from both. */
export const RETENTION_ELIGIBLE_MODES: readonly EvidenceMode[] = [
  'independent_check',
  'transfer_check',
  'retention_check',
];

export interface ER03CandidatePolicy {
  readonly policyVersion: string;
  readonly approved: false;
  readonly skills: Readonly<Record<string, ConceptualSkillPolicy>>;
}

/** ER-03 candidate policy v0.2 (educator Annex E). CANDIDATE — not approved. */
export const ER03_CANDIDATE_V02: ER03CandidatePolicy = {
  policyVersion: 'er03-fractions-g3g5-CANDIDATE-v0.2',
  approved: false,
  skills: {
    'SK-FR-partition': {
      skillId: 'SK-FR-partition',
      role: 'on-ramp',
      minIndependent: 4,
      dimensionQuota: { model: 2, value: 2 },
      minSessions: 1,
      minRepresentations: 2,
      retentionDelayHours: 48,
    },
    'SK-FR-unit': {
      skillId: 'SK-FR-unit',
      role: 'on-ramp',
      minIndependent: 3,
      dimensionQuota: { model: 1, value: 2 },
      minSessions: 1,
      minRepresentations: 2,
      retentionDelayHours: 48,
    },
    'SK-FR-nonunit': {
      skillId: 'SK-FR-nonunit',
      role: 'on-ramp',
      minIndependent: 4,
      dimensionQuota: { model: 2, value: 2 },
      minSessions: 1,
      minRepresentations: 2,
      retentionDelayHours: 72,
    },
    'SK-FR-equiv': {
      skillId: 'SK-FR-equiv',
      role: 'assessed-core',
      minIndependent: 5,
      dimensionQuota: { model: 1, value: 2, reasoning: 1, transfer: 1 },
      minSessions: 2,
      minRepresentations: 2,
      retentionDelayHours: 168,
    },
    'SK-FR-compare': {
      skillId: 'SK-FR-compare',
      role: 'assessed-core',
      minIndependent: 5,
      dimensionQuota: { model: 1, value: 2, reasoning: 1, transfer: 1 },
      minSessions: 2,
      minRepresentations: 2,
      retentionDelayHours: 168,
    },
  },
};

export type ConceptualState = 'UNKNOWN' | 'NOT_YET_DEMONSTRATED' | 'INDEPENDENT' | 'RETAINED';

export interface DimensionProgress {
  readonly dimension: EvidenceDimension;
  readonly have: number;
  readonly need: number;
  readonly met: boolean;
}

export interface ConceptualMasteryResult {
  readonly skillId: string;
  readonly policyVersion: string;
  readonly state: ConceptualState;
  readonly eligibleCount: number;
  readonly sessions: number;
  readonly representations: number;
  readonly dimensions: readonly DimensionProgress[];
  /** Human-readable reasons a skill is not yet INDEPENDENT (empty when it is). */
  readonly unmet: readonly string[];
  /** ISO timestamp at which all independent-mastery requirements were first met
   *  — the anchor the retention window is measured from. null until INDEPENDENT. */
  readonly independenceAt: string | null;
  /** The grade this evaluation was gated to, or null when no grade gate was
   *  applied (educator E5 — grade-specific claims must record the grade used). */
  readonly gradeTarget: number | null;
}

const isEligible = (e: ConceptualEvidence): boolean =>
  e.correct &&
  MASTERY_ELIGIBLE_BANDS.includes(e.assistanceBand) &&
  MASTERY_COUNTED_MODES.includes(e.mode);

/** A correct, unaided check that may satisfy the post-independence retention
 *  gate — includes `retention_check`, which never counts toward initial
 *  independence (educator R3). */
const isRetentionEligible = (e: ConceptualEvidence): boolean =>
  e.correct &&
  MASTERY_ELIGIBLE_BANDS.includes(e.assistanceBand) &&
  RETENTION_ELIGIBLE_MODES.includes(e.mode);

/** An assessment session: the explicit sessionId when present, else the UTC
 *  calendar day of observedAt (the documented derivation when none is supplied). */
const sessionOf = (e: ConceptualEvidence): string => e.sessionId ?? e.observedAt.slice(0, 10);

interface Requirements {
  readonly met: boolean;
  readonly dimensions: DimensionProgress[];
  readonly sessions: number;
  readonly representations: number;
  readonly eligibleFamilies: number;
  readonly unmet: string[];
}

/**
 * Check the non-retention requirements against a set of eligible events. Pure.
 * Counts only DISTINCT item families per dimension, so a repeated template
 * cannot satisfy two slots.
 */
function checkRequirements(
  eligible: readonly ConceptualEvidence[],
  policy: ConceptualSkillPolicy,
  /** All in-scope events for this learner+skill (any dimension, correctness or
   *  mode), used for the CHRONOLOGICAL transfer-novelty test. A transfer counts
   *  only if the learner had no EARLIER encounter with that item family; a later
   *  encounter must never retroactively invalidate a previously legitimate
   *  transfer (educator Stage-2 amendment, edge case 1 made chronological). */
  inScope: readonly ConceptualEvidence[] = [],
): Requirements {
  const usedFamilies = new Map<EvidenceDimension, Set<string>>();
  const countedEvents: ConceptualEvidence[] = [];
  for (const dim of EVIDENCE_DIMENSIONS) {
    const need = policy.dimensionQuota[dim] ?? 0;
    if (need === 0) continue;
    const seen = new Set<string>();
    for (const e of eligible) {
      if (e.dimension !== dim) continue;
      // Transfer evidence must be a genuine TRANSFER check — a novel uncoached
      // item — regardless of when reasoning was demonstrated. There is NO
      // temporal-ordering gate against reasoning (educator E4/R6: sequencing is
      // an instructional rule, not a mastery gate). Novelty is enforced
      // chronologically: a transfer must be in transfer_check mode AND the
      // learner must not have met that item family in any STRICTLY EARLIER
      // encounter. A later encounter does not invalidate it (educator Stage-2).
      if (dim === 'transfer') {
        if (e.mode !== 'transfer_check') continue;
        const t = Date.parse(e.observedAt);
        const earlierEncounter = inScope.some(
          (o) => o !== e && o.itemFamilyId === e.itemFamilyId && Date.parse(o.observedAt) < t,
        );
        if (earlierEncounter) continue;
      }
      if (seen.has(e.itemFamilyId)) continue;
      seen.add(e.itemFamilyId);
      countedEvents.push(e);
    }
    usedFamilies.set(dim, seen);
  }

  const dimensions: DimensionProgress[] = EVIDENCE_DIMENSIONS.filter(
    (d) => (policy.dimensionQuota[d] ?? 0) > 0,
  ).map((d) => {
    const need = policy.dimensionQuota[d] ?? 0;
    const have = usedFamilies.get(d)?.size ?? 0;
    return { dimension: d, have, need, met: have >= need };
  });

  const sessions = new Set(countedEvents.map(sessionOf)).size;
  const representations = new Set(countedEvents.map((e) => e.representation)).size;
  const eligibleFamilies = new Set(eligible.map((e) => e.itemFamilyId)).size;

  const unmet: string[] = [];
  for (const d of dimensions)
    if (!d.met) unmet.push(`${d.dimension}: ${d.have}/${d.need} independent demonstrations`);
  if (eligibleFamilies < policy.minIndependent)
    unmet.push(
      `only ${eligibleFamilies}/${policy.minIndependent} distinct independent item families`,
    );
  if (sessions < policy.minSessions)
    unmet.push(`only ${sessions}/${policy.minSessions} assessment sessions`);
  if (representations < policy.minRepresentations)
    unmet.push(`only ${representations}/${policy.minRepresentations} representations`);

  return {
    met: unmet.length === 0,
    dimensions,
    sessions,
    representations,
    eligibleFamilies,
    unmet,
  };
}

/**
 * The instant independence is first achieved: processing eligible events in
 * chronological order, the timestamp of the event that COMPLETES every
 * non-retention requirement, or null if they are never met. The retention
 * window starts here — NOT at first evidence (educator Stage-1 correction).
 */
function independenceAchievedAt(
  eligible: readonly ConceptualEvidence[],
  policy: ConceptualSkillPolicy,
  inScope: readonly ConceptualEvidence[],
): number | null {
  const chron = [...eligible].sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt));
  for (let i = 0; i < chron.length; i++) {
    if (checkRequirements(chron.slice(0, i + 1), policy, inScope).met)
      return Date.parse(chron[i]!.observedAt);
  }
  return null;
}

/**
 * Evaluate conceptual mastery for one skill from its evidence. Pure and
 * deterministic.
 */
export interface ConceptualEvalOptions {
  /** When set, only evidence tagged with this grade counts — the learner's
   *  target grade is then a separate gate and grade-crossing evidence is
   *  excluded (educator R7). When omitted, evidence is not filtered by grade
   *  and grade targeting is left to the caller's content-band gate. */
  readonly gradeTarget?: number;
}

export function evaluateConceptualMastery(
  events: readonly ConceptualEvidence[],
  policy: ConceptualSkillPolicy,
  options: ConceptualEvalOptions = {},
): ConceptualMasteryResult {
  const mine = events.filter(
    (e) =>
      e.skillId === policy.skillId &&
      (options.gradeTarget === undefined || e.gradeTarget === options.gradeTarget),
  );
  const eligible = mine.filter(isEligible);

  // All in-scope events drive the chronological transfer-novelty test: a transfer
  // is novel unless the learner met that family in a STRICTLY earlier encounter
  // (educator Stage-2 amendment — a later encounter never retroactively invalidates).
  const req = checkRequirements(eligible, policy, mine);

  // The moment independence was first achieved, if ever. The retention window is
  // measured from HERE, not from first evidence (educator Stage-1 correction).
  const anchor = req.met ? independenceAchievedAt(eligible, policy, mine) : null;

  let state: ConceptualState;
  if (mine.length === 0) state = 'UNKNOWN';
  else if (!req.met) state = 'NOT_YET_DEMONSTRATED';
  else {
    // RETAINED needs a delayed unaided check (independent/transfer/retention
    // mode; retention_check counts only here, R3) at least the delay after
    // independence, on a FRESH family. Freshness is measured against ALL prior
    // exposure to that family — any earlier encounter, including incorrect or
    // assisted/teaching ones, not only successful mastery evidence (educator
    // edge case 2 / E3).
    const delayMs = policy.retentionDelayHours * 3_600_000;
    const retained =
      anchor !== null &&
      mine.filter(isRetentionEligible).some((e) => {
        const t = Date.parse(e.observedAt);
        if (t < anchor + delayMs) return false;
        const priorExposure = mine.some(
          (o) => o !== e && o.itemFamilyId === e.itemFamilyId && Date.parse(o.observedAt) < t,
        );
        return !priorExposure;
      });
    state = retained ? 'RETAINED' : 'INDEPENDENT';
  }

  return {
    skillId: policy.skillId,
    policyVersion: ER03_CANDIDATE_V02.policyVersion,
    state,
    eligibleCount: req.eligibleFamilies,
    sessions: req.sessions,
    representations: req.representations,
    dimensions: req.dimensions,
    unmet: req.unmet,
    independenceAt: anchor === null ? null : new Date(anchor).toISOString(),
    gradeTarget: options.gradeTarget ?? null,
  };
}

/**
 * Fail-closed entry point for the assessed-core pipeline (educator decision #10,
 * 2026-10-21): a grade-specific INDEPENDENT/RETAINED claim MUST be gated on the
 * learner's target grade. Unlike the generic evaluator — whose grade filter is
 * optional for internal uses — this refuses to run without a `gradeTarget` and
 * only accepts an assessed-core policy, so ungated or on-ramp evidence can never
 * produce a grade-specific assessed-core mastery claim. The returned result
 * always records the grade it was evaluated at.
 */
export function evaluateAssessedCoreMastery(
  events: readonly ConceptualEvidence[],
  policy: ConceptualSkillPolicy,
  gradeTarget: number,
): ConceptualMasteryResult {
  if (policy.role !== 'assessed-core')
    throw new Error(
      `evaluateAssessedCoreMastery requires an assessed-core policy; ${policy.skillId} is ${policy.role}`,
    );
  if (!Number.isInteger(gradeTarget))
    throw new Error(
      'evaluateAssessedCoreMastery requires an explicit integer gradeTarget (fail-closed)',
    );
  return evaluateConceptualMastery(events, policy, { gradeTarget });
}
