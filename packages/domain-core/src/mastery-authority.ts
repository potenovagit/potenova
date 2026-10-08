import { type ActorContext, DomainError } from '@potenova/contracts';

/**
 * Learner-State write authority.
 *
 * LOCKED invariant (Master §4; Architecture §4; State machine 3.1 "Forbidden";
 * TM-07, TM-08; AT-56): LearnerSkillState is a derived, versioned projection.
 * ONLY the learner-state projector may advance it, and only via a replay of
 * immutable evidence under an approved policy version. Tutor UI, parent, billing
 * and operators can submit evidence or request state, but can NEVER set mastery.
 *
 * This module encodes that invariant as code so it is enforced (and tested) at
 * the architecture-fitness level, independent of any later storage choice.
 */

export const SKILL_STATES = [
  'UNASSESSED',
  'EMERGING',
  'DEVELOPING',
  'INDEPENDENT',
  'RETAINED',
  'TRANSFERABLE',
  'REVALIDATION_REQUIRED',
] as const;

export type SkillState = (typeof SKILL_STATES)[number];

export interface ProjectionPromotion {
  readonly learnerAlias: string;
  readonly skillId: string;
  /** Monotonic version of the projection being superseded. */
  readonly fromProjectionVersion: number;
  readonly toState: SkillState;
  /** Must be derived from a shadow replay, not a hand-set value. */
  readonly derivedFromShadowReplay: boolean;
  readonly approvedPolicyVersion: string;
}

export interface PromotionResult {
  readonly learnerAlias: string;
  readonly skillId: string;
  readonly projectionVersion: number;
  readonly state: SkillState;
}

/**
 * Advance a learner's projected skill state. Rejects (fail-closed) any actor
 * other than the learner-state projector, and any promotion not derived from an
 * authorised shadow replay (C-10 LearnerModel.PromoteProjection).
 *
 * @throws DomainError FORBIDDEN_ROLE  — actor is not the projector authority
 * @throws DomainError POLICY_BLOCKED  — promotion not derived from shadow replay
 * @throws DomainError STALE_VERSION   — optimistic-concurrency guard
 */
export function promoteProjection(
  actor: ActorContext,
  currentProjectionVersion: number,
  promotion: ProjectionPromotion,
): PromotionResult {
  if (actor.actorType !== 'learner_state_projector') {
    // Tutor, parent, billing, operator, child — all denied. (TM-07/TM-08, AT-56)
    throw new DomainError('FORBIDDEN_ROLE', 'learner mastery is not directly writable');
  }
  if (!promotion.derivedFromShadowReplay) {
    throw new DomainError('POLICY_BLOCKED', 'mastery change must come from evidence replay');
  }
  if (promotion.fromProjectionVersion !== currentProjectionVersion) {
    throw new DomainError('STALE_VERSION', 'projection version is stale');
  }
  return {
    learnerAlias: promotion.learnerAlias,
    skillId: promotion.skillId,
    projectionVersion: currentProjectionVersion + 1,
    state: promotion.toState,
  };
}
