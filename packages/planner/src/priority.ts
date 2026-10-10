import type { PlannerPolicy } from './policy';

/**
 * Session planner decision order (AI Learning Eval §4; AT-08/13/29/56).
 *
 * The seven priority tiers, highest first:
 *   1. Non-negotiable gates — child safety, data-purpose/residency, entitlement,
 *      age/session ceiling. A violated gate SUPPRESSES the objective (SAFETY_LIMIT);
 *      it is never merely deprioritized.
 *   2. Confirmed prerequisite gaps / high-dependency skills.
 *   3. Retention/retrieval risk and unresolved mastery confidence.
 *   4. Temporary parent school topic / test-prep emphasis.
 *   5. Progression and transfer to new contexts.
 *   6. Child agency / optional subject switches.
 *   7. Operational efficiency (tiebreak only).
 *
 * Parent preference may reorder WITHIN a tier but never crosses a non-negotiable
 * gate (AT-29). Per-strand signals are respected — no grade-wide label (AT-13).
 * Every objective carries an audit reason code.
 */

export const SESSION_REASON_CODES = [
  'SAFETY_LIMIT',
  'PREREQUISITE_REMEDIATION',
  'REVIEW_DUE',
  'LOW_CONFIDENCE_VERIFICATION',
  'MASTERY_CHECK',
  'SCHOOL_ALIGNMENT',
  'TRANSFER_CHECK',
  'ADVANCEMENT',
  'PARENT_PREFERENCE',
] as const;
export type SessionReasonCode = (typeof SESSION_REASON_CODES)[number];

export interface ObjectiveSignal {
  readonly skillId: string;
  /** Tier-1 non-negotiable gate failed (safety/consent/entitlement/age). */
  readonly safetyBlocked: boolean;
  readonly prerequisiteGap: boolean;
  readonly highDependency: boolean;
  readonly retentionRisk: boolean;
  /** 0..1 current mastery/placement confidence. */
  readonly masteryConfidence: number;
  readonly unresolvedConfidence: boolean;
  readonly schoolPriority: boolean;
  readonly isTransfer: boolean;
  readonly isAdvancement: boolean;
  /** Parent-preferred — reorders within a tier only (never crosses a gate). */
  readonly parentPreferred: boolean;
}

export interface PrioritizedObjective {
  readonly skillId: string;
  readonly tier: number;
  readonly reasonCode: SessionReasonCode;
  /** True when a non-negotiable gate removed it from the session. */
  readonly suppressed: boolean;
}

export function classifyObjective(o: ObjectiveSignal, policy: PlannerPolicy): PrioritizedObjective {
  if (o.safetyBlocked) {
    return { skillId: o.skillId, tier: 1, reasonCode: 'SAFETY_LIMIT', suppressed: true };
  }
  if (o.prerequisiteGap) {
    return {
      skillId: o.skillId,
      tier: 2,
      reasonCode: 'PREREQUISITE_REMEDIATION',
      suppressed: false,
    };
  }
  if (o.retentionRisk) {
    return { skillId: o.skillId, tier: 3, reasonCode: 'REVIEW_DUE', suppressed: false };
  }
  if (o.unresolvedConfidence || o.masteryConfidence < policy.verifyConfidence) {
    return {
      skillId: o.skillId,
      tier: 3,
      reasonCode: 'LOW_CONFIDENCE_VERIFICATION',
      suppressed: false,
    };
  }
  if (o.masteryConfidence < policy.sufficientConfidence) {
    return { skillId: o.skillId, tier: 3, reasonCode: 'MASTERY_CHECK', suppressed: false };
  }
  if (o.schoolPriority) {
    return { skillId: o.skillId, tier: 4, reasonCode: 'SCHOOL_ALIGNMENT', suppressed: false };
  }
  if (o.isTransfer) {
    return { skillId: o.skillId, tier: 5, reasonCode: 'TRANSFER_CHECK', suppressed: false };
  }
  if (o.isAdvancement) {
    return { skillId: o.skillId, tier: 5, reasonCode: 'ADVANCEMENT', suppressed: false };
  }
  return { skillId: o.skillId, tier: 6, reasonCode: 'PARENT_PREFERENCE', suppressed: false };
}

/**
 * Rank objectives. Suppressed (gated) objectives sort last and are excluded from
 * the deliverable session by the session planner. Parent preference only breaks
 * ties within a tier, so a preferred advancement never outranks a prerequisite.
 */
export function prioritize(
  signals: readonly ObjectiveSignal[],
  policy: PlannerPolicy,
): PrioritizedObjective[] {
  const bySkill = new Map(signals.map((s) => [s.skillId, s]));
  return signals
    .map((s) => classifyObjective(s, policy))
    .sort((a, b) => {
      if (a.suppressed !== b.suppressed) return a.suppressed ? 1 : -1;
      if (a.tier !== b.tier) return a.tier - b.tier;
      const pa = bySkill.get(a.skillId)!.parentPreferred ? 0 : 1;
      const pb = bySkill.get(b.skillId)!.parentPreferred ? 0 : 1;
      if (pa !== pb) return pa - pb;
      return a.skillId.localeCompare(b.skillId);
    });
}
