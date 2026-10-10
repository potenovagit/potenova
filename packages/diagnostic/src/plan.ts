import { isDeliverableState, type AssetState } from '@potenova/content';
import { DomainError } from '@potenova/contracts';
import type { CurriculumGraph } from '@potenova/curriculum';
import type { DiagnosticPolicy } from './policy';
import type { BaselineProfile, SkillBaseline } from './profile';

/**
 * Initial learning-plan generation (DIA-007/008; AI Learning Eval §4).
 *
 * Turns a baseline profile into an ordered, reason-coded plan available
 * immediately after the diagnostic. Ordering follows the planner priority:
 * confirmed prerequisite gaps first (teach roots before dependents), then
 * low-confidence verification, then advancement. Every item carries a reason
 * code and a confidence-limited flag so a trial parent sees a meaningful plan
 * WITH its uncertainty (DIA-007). This layer proposes; it never sets mastery and
 * never finalizes a child-facing task on its own.
 */

export const PLAN_REASON_CODES = [
  'PREREQUISITE_REMEDIATION',
  'LOW_CONFIDENCE_VERIFICATION',
  'MASTERY_CHECK',
  'REVIEW_DUE',
  'ADVANCEMENT',
] as const;
export type PlanReasonCode = (typeof PLAN_REASON_CODES)[number];

export interface PlanItem {
  readonly skillId: string;
  readonly reasonCode: PlanReasonCode;
  /** True when the item rests on thin/uncertain evidence (surfaced to the parent). */
  readonly confidenceLimited: boolean;
}

export interface LearningPlan {
  readonly runId: string;
  readonly planVersion: string;
  readonly items: readonly PlanItem[];
  /** True when any target dimension remains explicitly unknown (DIA-003). */
  readonly hasUnknowns: boolean;
}

function reasonFor(b: SkillBaseline, isPrerequisite: boolean): PlanReasonCode {
  if (b.standing === 'needs_review') return 'REVIEW_DUE';
  if (b.standing === 'unknown' || b.standing === 'emerging') {
    return isPrerequisite ? 'PREREQUISITE_REMEDIATION' : 'LOW_CONFIDENCE_VERIFICATION';
  }
  if (b.standing === 'developing') return 'MASTERY_CHECK';
  return 'ADVANCEMENT'; // demonstrated
}

/** Rank: prerequisites first, then by lowest confidence, then skillId (stable). */
function priority(reason: PlanReasonCode): number {
  const order: Record<PlanReasonCode, number> = {
    PREREQUISITE_REMEDIATION: 0,
    REVIEW_DUE: 1,
    LOW_CONFIDENCE_VERIFICATION: 2,
    MASTERY_CHECK: 3,
    ADVANCEMENT: 4,
  };
  return order[reason];
}

export function generateInitialPlan(
  runId: string,
  profile: BaselineProfile,
  graph: CurriculumGraph,
  targetSkillIds: readonly string[],
  policy: DiagnosticPolicy,
): LearningPlan {
  // A skill is a "prerequisite" item when it appears in the closure of any target.
  const prerequisiteSet = new Set<string>();
  for (const t of targetSkillIds) {
    for (const pre of graph.prerequisiteClosure(t)) prerequisiteSet.add(pre);
  }

  const items = profile.skills
    .map((b): PlanItem => {
      const reasonCode = reasonFor(b, prerequisiteSet.has(b.skillId));
      return {
        skillId: b.skillId,
        reasonCode,
        confidenceLimited: b.confidence < policy.sufficientConfidence,
      };
    })
    .sort((a, b) => {
      const pa = priority(a.reasonCode);
      const pb = priority(b.reasonCode);
      if (pa !== pb) return pa - pb;
      return a.skillId.localeCompare(b.skillId);
    });

  const hasUnknowns = profile.skills.some((s) => s.unknownDimensions.length > 0);
  return { runId, planVersion: policy.policyVersion, items, hasUnknowns };
}

/**
 * WP-05 boundary (executable): any concrete task a diagnostic probe resolves to
 * MUST come from the validated-content library in a deliverable state. The
 * diagnostic never bypasses the content gate to put an item in front of a child.
 *
 * @throws DomainError POLICY_BLOCKED — a non-deliverable asset state.
 */
export function assertProbeDeliverable(assetState: AssetState): void {
  if (!isDeliverableState(assetState)) {
    throw new DomainError(
      'POLICY_BLOCKED',
      `a diagnostic probe may only use validated, deliverable content (got ${assetState})`,
    );
  }
}
