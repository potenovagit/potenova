/**
 * Diagnostic policy (WP-06) — versioned, DRAFT parameters.
 *
 * ============================================================================
 *  EVIDENCE REQUIRED (DIA calibration; DIA-001/006/012; NFR-09): the selection
 *  weights and confidence/stopping thresholds below are DRAFT placeholders, NOT
 *  approved. Real values are calibrated through simulated learners, expert
 *  scenarios and beta evidence before G2. They are isolated behind a version
 *  string so recalibration is a policy-version bump — never a logic rewrite.
 *
 *  Design invariant (DIA-006): diagnostic termination depends on evidence
 *  confidence and learner constraints, NEVER on a fixed question count.
 *  `attentionBudget` is only the learner-protection ceiling that forces a
 *  PARTIAL stop — it is not a target to reach.
 * ============================================================================
 */

export interface SelectionWeights {
  /** Value of probing where current confidence is low / state uncertain. */
  readonly infoGain: number;
  /** Prefer foundational skills that many targets depend on (teach roots first). */
  readonly foundational: number;
  /** Prefer skills near the learner's registered grade. */
  readonly gradeRelevance: number;
  /** Penalty for re-probing an already well-covered skill (task diversity). */
  readonly diversity: number;
}

export interface DiagnosticPolicy {
  readonly policyVersion: string;
  /** Per-skill confidence at or above which a skill is treated as resolved (reuse, DIA-002). */
  readonly sufficientConfidence: number;
  /** Minimum candidate score worth a probe; below it, nothing is worth asking → SUFFICIENT. */
  readonly minProbeScore: number;
  /** Learner-protection ceiling on probes; exceeding it forces a PARTIAL stop. */
  readonly attentionBudget: number;
  readonly weights: SelectionWeights;
}

/** DRAFT policy — placeholder values pending DIA calibration. */
export const DRAFT_DIAGNOSTIC_POLICY: DiagnosticPolicy = {
  policyVersion: 'diag-DRAFT-0.1(ER-DIA-UNCALIBRATED)',
  sufficientConfidence: 0.8,
  minProbeScore: 0.15,
  attentionBudget: 12,
  weights: {
    infoGain: 0.5,
    foundational: 0.25,
    gradeRelevance: 0.15,
    diversity: 0.1,
  },
};
