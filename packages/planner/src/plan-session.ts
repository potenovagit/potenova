import { assertProbeDeliverable } from '@potenova/diagnostic';
import type { AssetState } from '@potenova/content';
import type { PlannerPolicy } from './policy';
import type { PrioritizedObjective, SessionReasonCode } from './priority';

/**
 * Adaptive session plan assembly (AI Learning §4; DIA-007 continuity; AT-08/29).
 *
 * Takes prioritized objectives and produces a bounded, reason-coded session plan.
 * Non-negotiable-gated (suppressed) objectives never enter the session. New-concept
 * introduction is capped adaptively, and the session-item ceiling bounds the plan
 * ("time is a constraint, not a target"). Items cut by a cap are reported, not
 * silently dropped. The plan is a proposal — it sets no mastery.
 */

const NEW_CONCEPT_REASONS: ReadonlySet<SessionReasonCode> = new Set<SessionReasonCode>([
  'ADVANCEMENT',
  'TRANSFER_CHECK',
]);

export interface SessionItem {
  readonly skillId: string;
  readonly reasonCode: SessionReasonCode;
  readonly isNewConcept: boolean;
}

export interface SessionPlan {
  readonly sessionId: string;
  readonly planVersion: string;
  readonly items: readonly SessionItem[];
  readonly droppedForBudget: readonly string[];
  readonly suppressedSkillIds: readonly string[];
}

export function buildSessionPlan(
  sessionId: string,
  prioritized: readonly PrioritizedObjective[],
  policy: PlannerPolicy,
): SessionPlan {
  const items: SessionItem[] = [];
  const droppedForBudget: string[] = [];
  const suppressedSkillIds: string[] = [];
  let newConcepts = 0;

  for (const o of prioritized) {
    if (o.suppressed) {
      suppressedSkillIds.push(o.skillId);
      continue;
    }
    const isNewConcept = NEW_CONCEPT_REASONS.has(o.reasonCode);
    const atItemCap = items.length >= policy.maxSessionItems;
    const atNewConceptCap = isNewConcept && newConcepts >= policy.maxNewConceptsPerSession;
    if (atItemCap || atNewConceptCap) {
      droppedForBudget.push(o.skillId);
      continue;
    }
    items.push({ skillId: o.skillId, reasonCode: o.reasonCode, isNewConcept });
    if (isNewConcept) newConcepts++;
  }

  return {
    sessionId,
    planVersion: policy.policyVersion,
    items,
    droppedForBudget,
    suppressedSkillIds,
  };
}

/**
 * WP-05 boundary (executable): a session item may only be delivered to a child
 * from validated, deliverable content. Reuses the diagnostic/content gate so the
 * whole WP-07 -> WP-06 -> WP-05 chain shares one deliverability invariant.
 *
 * @throws DomainError POLICY_BLOCKED — a non-deliverable content state.
 */
export function assertSessionItemDeliverable(assetState: AssetState): void {
  assertProbeDeliverable(assetState);
}
