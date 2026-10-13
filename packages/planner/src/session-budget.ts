import type { PlannerPolicy } from './policy';

/**
 * Session item budget (ER-09, learner-protection). Bounds a single session so a
 * child is never pushed through an unbounded number of items or flooded with new
 * concepts in one sitting:
 *   - maxSessionItems         — hard ceiling on graded items; reaching it ends
 *                               the session cleanly (COMPLETED).
 *   - maxNewConceptsPerSession — ceiling on DISTINCT skills introduced in one
 *                               session; a further new concept is blocked so the
 *                               learner consolidates rather than sprawls.
 *
 * Pure and policy-driven. The DRAFT values are UNCALIBRATED placeholders
 * (ER-09 pending child-safety sign-off) — this enforces the mechanism, not an
 * approved number.
 */

export interface SessionBudgetInput {
  /** Graded items already recorded this session (across all skills). */
  readonly itemsDelivered: number;
  /** Distinct skills already worked this session. */
  readonly distinctSkillsThisSession: readonly string[];
  /** The skill a turn is about to work (for the new-concept check). */
  readonly candidateSkillId?: string;
}

export type SessionBudgetReason = 'OK' | 'ITEM_CEILING' | 'CONCEPT_BUDGET';

export interface SessionBudgetStatus {
  readonly maxItems: number;
  readonly itemsDelivered: number;
  readonly itemsRemaining: number;
  readonly itemCeilingReached: boolean;
  readonly maxNewConcepts: number;
  readonly conceptsIntroduced: number;
  readonly conceptsRemaining: number;
  readonly candidateIsNewConcept: boolean;
  readonly newConceptBlocked: boolean;
  /** True only when a candidate turn may proceed (not over any ceiling). */
  readonly allowed: boolean;
  readonly reason: SessionBudgetReason;
  readonly policyVersion: string;
}

export function sessionBudgetStatus(
  input: SessionBudgetInput,
  policy: PlannerPolicy,
): SessionBudgetStatus {
  const itemsRemaining = Math.max(0, policy.maxSessionItems - input.itemsDelivered);
  const itemCeilingReached = input.itemsDelivered >= policy.maxSessionItems;

  const distinct = new Set(input.distinctSkillsThisSession);
  const conceptsIntroduced = distinct.size;
  const conceptsRemaining = Math.max(0, policy.maxNewConceptsPerSession - conceptsIntroduced);

  const candidateIsNewConcept =
    input.candidateSkillId !== undefined && !distinct.has(input.candidateSkillId);
  const newConceptBlocked =
    candidateIsNewConcept && conceptsIntroduced >= policy.maxNewConceptsPerSession;

  const reason: SessionBudgetReason = itemCeilingReached
    ? 'ITEM_CEILING'
    : newConceptBlocked
      ? 'CONCEPT_BUDGET'
      : 'OK';

  return {
    maxItems: policy.maxSessionItems,
    itemsDelivered: input.itemsDelivered,
    itemsRemaining,
    itemCeilingReached,
    maxNewConcepts: policy.maxNewConceptsPerSession,
    conceptsIntroduced,
    conceptsRemaining,
    candidateIsNewConcept,
    newConceptBlocked,
    allowed: reason === 'OK',
    reason,
    policyVersion: policy.policyVersion,
  };
}
