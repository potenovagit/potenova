import { DomainError } from '@potenova/contracts';

/**
 * Mastery policy (WP-03) — versioned, DRAFT parameters.
 *
 * ============================================================================
 *  EVIDENCE REQUIRED (ER-03 / DEC-MASTERY): the numeric thresholds below are
 *  DRAFT placeholders, NOT approved. Real mastery-confidence thresholds and
 *  weights by skill/dependency class are calibrated through simulation, expert
 *  review and beta evidence before G2 (NFR-09). They are isolated here, behind
 *  a version string, so recalibration is a policy-version bump — never a code
 *  rewrite and never a change to stored evidence.
 * ============================================================================
 */
export interface MasteryPolicy {
  readonly policyVersion: string;
  /** Distinct unaided (A0/A1) correct observations required to reach INDEPENDENT. */
  readonly minUnaidedForIndependent: number;
  /** Distinct representations those unaided observations must span (AT-10). */
  readonly minRepresentationsForIndependent: number;
  /** Delay before an independent retrieval counts toward RETAINED (ms) (AT-11). */
  readonly retentionDelayMs: number;
  /** Bands treated as "unaided" for independence. A2+ are assisted. */
  readonly unaidedBands: readonly string[];
  /**
   * Signed off by the independent educator review (ER-03 / NFR-08)? The DRAFT
   * values are NOT approved — mastery may be derived for synthetic/non-prod work,
   * but prod fails closed until a calibrated, educator-approved policy is loaded.
   */
  readonly approved: boolean;
}

/** DRAFT policy — placeholder values pending ER-03 calibration. Never approved. */
export const DRAFT_MASTERY_POLICY: MasteryPolicy = {
  policyVersion: 'mastery-DRAFT-0.1(ER-03-UNCALIBRATED)',
  minUnaidedForIndependent: 3,
  minRepresentationsForIndependent: 2,
  retentionDelayMs: 24 * 60 * 60 * 1000, // 24h placeholder
  unaidedBands: ['A0', 'A1'],
  approved: false,
};

/**
 * Prod gate: mastery must not be derived from an uncalibrated DRAFT policy once
 * real child data is in play. Advisory in non-prod (synthetic work continues).
 *
 * @throws DomainError POLICY_BLOCKED — prod with an unapproved mastery policy.
 */
export function assertMasteryPolicyApproved(policy: MasteryPolicy, isProd: boolean): void {
  if (isProd && !policy.approved) {
    throw new DomainError(
      'POLICY_BLOCKED',
      `mastery policy ${policy.policyVersion} is not approved (ER-03 calibration pending)`,
    );
  }
}
