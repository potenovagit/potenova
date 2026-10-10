/**
 * Planner / tutoring policy (WP-07) — versioned, DRAFT parameters.
 *
 * ============================================================================
 *  EVIDENCE REQUIRED: every number here is a DRAFT placeholder, NOT approved.
 *   - Per-band session/daily caps (maxSessionItems, new-concept limit): ER-09 /
 *     ER-08 — behavioural age-band parameters are explicitly deferred (see
 *     identity age-band note); NOT final.
 *   - Confidence thresholds: ER-03 (shared with mastery calibration).
 *   - Stall count and retention decay window: uncalibrated, pending beta
 *     evidence (NFR-09).
 *  They are isolated behind a version string so recalibration is a policy-version
 *  bump — never a logic rewrite. "Time is a constraint, not a utilization
 *  target": these ceilings bound a session; they are never goals to fill.
 * ============================================================================
 */
export interface PlannerPolicy {
  readonly policyVersion: string;
  /** Below this per-skill confidence, the skill needs verification before advancing. */
  readonly verifyConfidence: number;
  /** At/above this confidence a skill is treated as resolved. */
  readonly sufficientConfidence: number;
  /** Consecutive non-progress attempts before the strategy MUST change (AT-08). */
  readonly stallAttempts: number;
  /** Elapsed time after which a previously-mastered skill is "threatened" (AT-57). */
  readonly retentionDecayWindowMs: number;
  /** Adaptive ceiling on newly-introduced concepts per session. */
  readonly maxNewConceptsPerSession: number;
  /** Session-budget ceiling on deliverable items (learner-protection, ER-09). */
  readonly maxSessionItems: number;
}

/** DRAFT policy — placeholder values pending calibration. */
export const DRAFT_PLANNER_POLICY: PlannerPolicy = {
  policyVersion: 'planner-DRAFT-0.1(ER-03/08/09-UNCALIBRATED)',
  verifyConfidence: 0.5,
  sufficientConfidence: 0.8,
  stallAttempts: 2,
  retentionDecayWindowMs: 21 * 24 * 60 * 60 * 1000, // 21-day placeholder
  maxNewConceptsPerSession: 2,
  maxSessionItems: 8,
};
