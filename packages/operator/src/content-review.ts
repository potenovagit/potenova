import { DomainError } from '@potenova/contracts';
import { QuarantineRegistry, type QuarantineRecord } from '@potenova/content';

/**
 * Operations content-review console (OPS-010; AT-48/49).
 *
 * Surfaces validation failures, disputed grading and low-confidence cases. An
 * authorized reviewer can quarantine an asset (driving the WP-05 registry, which
 * records version + action and opens a regression case — AT-49) and must document
 * the decision. Support cases route by type with minimal metadata only, unless an
 * approved sensitive-access elevation is present (AT-48).
 */

export const REVIEW_CASE_KINDS = [
  'validation_failure',
  'disputed_grading',
  'low_confidence',
] as const;
export type ReviewCaseKind = (typeof REVIEW_CASE_KINDS)[number];

export interface ReviewCase {
  readonly caseId: string;
  readonly kind: ReviewCaseKind;
  readonly assetId: string;
  readonly assetVersion: string;
}

/**
 * Reviewer quarantines an asset from the console (AT-49). Requires a reviewer and
 * a documented reason; returns the WP-05 quarantine record (with regression case).
 *
 * @throws DomainError FORBIDDEN_ROLE — missing reviewer.
 */
export function operatorQuarantine(
  registry: QuarantineRegistry,
  reviewCase: ReviewCase,
  input: { reviewer: string; reasonCode: string },
): QuarantineRecord {
  if (!input.reviewer)
    throw new DomainError('FORBIDDEN_ROLE', 'quarantine requires an authorized reviewer');
  return registry.quarantine({
    assetId: reviewCase.assetId,
    assetVersion: reviewCase.assetVersion,
    reasonCode: input.reasonCode,
    actor: input.reviewer,
  });
}

export type SupportCaseType = 'wrong_answer' | 'technical_error';

export interface SupportRouting {
  readonly queue: 'content_quality' | 'engineering';
  /** AT-48: minimal metadata only unless an approved sensitive-access elevation exists. */
  readonly includesChildContent: boolean;
}

/** AT-48: route a support case by type with minimal metadata by default. */
export function routeSupportCase(
  type: SupportCaseType,
  approvedSensitiveAccess = false,
): SupportRouting {
  return {
    queue: type === 'wrong_answer' ? 'content_quality' : 'engineering',
    includesChildContent: approvedSensitiveAccess,
  };
}
