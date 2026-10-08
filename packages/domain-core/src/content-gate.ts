import { DomainError } from '@potenova/contracts';

/**
 * Child-facing content delivery gate.
 *
 * LOCKED invariant (AI-001; Master §4; Architecture §4; TM-09/TM-10/TM-40;
 * AT-20/AT-21/AT-39; C-14/C-15): no generated content or free-form tutor turn
 * reaches a child unless an INDEPENDENT validator returns PASS. FAIL or UNCERTAIN
 * must serve an approved fallback asset or disable the capability — never deliver.
 * If the validator itself is unavailable, fail closed (no delivery).
 */

export type ValidationVerdict = 'PASS' | 'FAIL' | 'UNCERTAIN' | 'UNAVAILABLE';

export interface CandidateContent {
  readonly candidateId: string;
  readonly verdict: ValidationVerdict;
  /** Signed, independent validation record reference (audit/trace). */
  readonly validationRecordRef: string | null;
}

export interface ApprovedFallback {
  readonly assetId: string;
}

export type DeliveryOutcome =
  | { readonly kind: 'DELIVER'; readonly candidateId: string }
  | { readonly kind: 'FALLBACK'; readonly assetId: string }
  | { readonly kind: 'BLOCK'; readonly reason: 'SAFETY_BLOCKED' | 'VALIDATION_UNAVAILABLE' };

/**
 * Decide what (if anything) may be shown to the child.
 *
 * @throws DomainError POLICY_BLOCKED — PASS verdict without a signed validation record
 */
export function decideDelivery(
  candidate: CandidateContent,
  fallback: ApprovedFallback | null,
): DeliveryOutcome {
  if (candidate.verdict === 'PASS') {
    if (!candidate.validationRecordRef) {
      // A PASS with no signed record is not trustworthy — refuse.
      throw new DomainError('POLICY_BLOCKED', 'PASS requires a signed validation record');
    }
    return { kind: 'DELIVER', candidateId: candidate.candidateId };
  }

  // FAIL / UNCERTAIN / UNAVAILABLE → never deliver the candidate.
  if (fallback) {
    return { kind: 'FALLBACK', assetId: fallback.assetId };
  }
  return {
    kind: 'BLOCK',
    reason: candidate.verdict === 'UNAVAILABLE' ? 'VALIDATION_UNAVAILABLE' : 'SAFETY_BLOCKED',
  };
}
