import { decideDelivery, type ApprovedFallback, type DeliveryOutcome } from '@potenova/domain-core';
import { isDeliverableState, type AssetState } from './asset';
import {
  validateCandidate,
  validationRecordRef,
  type ValidationInput,
  type ValidationRecord,
} from './validation';

/**
 * generate -> validate -> deliver orchestration (AI §7; CONT-004/005; AT-20/AT-39).
 *
 * This module decides what, if anything, reaches a child. It never calls a model and
 * never promotes content on its own (automatic promotion is explicitly out of WP-05).
 * It composes the independent validator with the LOCKED child-facing content-gate in
 * @potenova/domain-core so there is exactly one delivery decision point.
 */

export interface PipelineResult {
  readonly outcome: DeliveryOutcome;
  readonly verdict: ValidationRecord['verdict'];
  readonly record: ValidationRecord;
}

/**
 * Validate a freshly generated candidate and decide delivery.
 *
 * - PASS (with its signed record)  -> DELIVER
 * - FAIL / UNCERTAIN               -> approved FALLBACK, else BLOCK(SAFETY_BLOCKED)
 * - UNAVAILABLE (validator outage) -> approved FALLBACK, else BLOCK(VALIDATION_UNAVAILABLE)
 */
export function produceAndDeliver(
  validation: ValidationInput,
  fallback: ApprovedFallback | null,
  now?: () => string,
): PipelineResult {
  const record = validateCandidate(validation, now);
  const outcome = decideDelivery(
    {
      candidateId: validation.candidateId,
      verdict: record.verdict,
      validationRecordRef: record.verdict === 'PASS' ? validationRecordRef(record) : null,
    },
    fallback,
  );
  return { outcome, verdict: record.verdict, record };
}

export interface SelectableAsset {
  readonly assetId: string;
  readonly state: AssetState;
  readonly objectiveSkillIds: readonly string[];
}

/**
 * Reuse-first, educationally-fit selection (CONT-005). Prefer an already-approved,
 * non-quarantined asset for the objective skill. A quarantined or non-deliverable
 * asset is never selectable — not even to save a generation call (CONT-005/CONT-007).
 * Returns null when nothing qualifies, so the caller must generate+validate instead.
 */
export function selectReusableAsset(
  pool: readonly SelectableAsset[],
  objectiveSkillId: string,
  isQuarantined: (assetId: string) => boolean,
): SelectableAsset | null {
  for (const asset of pool) {
    if (isQuarantined(asset.assetId)) continue;
    if (!isDeliverableState(asset.state)) continue;
    if (asset.objectiveSkillIds.includes(objectiveSkillId)) return asset;
  }
  return null;
}
