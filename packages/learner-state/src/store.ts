import { type ActorContext, DomainError } from '@potenova/contracts';
import { promoteProjection, type SkillState } from '@potenova/domain-core';
import type { MasteryEvidence, EvidenceCorrectionRecord } from './evidence';
import { type MasteryPolicy, DRAFT_MASTERY_POLICY } from './policy';
import { projectShadow, type SkillProjection } from './projection';
import {
  evaluateConceptualMastery,
  evaluateAssessedCoreMastery,
  type ConceptualEvidence,
  type ConceptualSkillPolicy,
  type ConceptualMasteryResult,
} from './conceptual-mastery';

/**
 * Learner-state store (WP-03) — storage-agnostic reference implementation.
 * Source: LRN-003; C-08/C-09/C-10; State machine 3.1; AT-05/09..13/50/56/60.
 *
 * Evidence is append-only; corrections append (never rewrite). Stored skill
 * state is advanced ONLY by replaying evidence into a shadow projection and
 * promoting through the mastery-authority (projector-only, derived-from-replay).
 * There is deliberately NO API to set state directly — tutor, parent and
 * billing have no path to mastery here (AT-56; TM-07/08).
 */

interface StoredProjection {
  readonly projectionVersion: number;
  readonly state: SkillState;
}

const PROJECTOR: ActorContext = {
  actorType: 'learner_state_projector',
  actorAlias: 'learner-state-engine',
  familyAlias: null,
  purpose: 'evidence_projection',
};

const key = (learner: string, skill: string): string => `${learner}:::${skill}`;

export class LearnerStateStore {
  readonly #policy: MasteryPolicy;
  readonly #evidence = new Map<string, MasteryEvidence[]>(); // by learnerAlias (append-only)
  readonly #corrections = new Map<string, EvidenceCorrectionRecord[]>(); // by learnerAlias
  readonly #projections = new Map<string, StoredProjection>(); // by learner:::skill

  constructor(policy: MasteryPolicy = DRAFT_MASTERY_POLICY) {
    this.#policy = policy;
  }

  /** Append immutable evidence (trusted producers only) and reproject its skill. */
  ingest(actor: ActorContext, event: MasteryEvidence): void {
    if (actor.actorType !== 'evidence_producer') {
      throw new DomainError(
        'FORBIDDEN_ROLE',
        'only trusted evidence producers may submit evidence',
      );
    }
    const list = this.#evidence.get(event.learnerAlias) ?? [];
    if (list.some((e) => e.eventId === event.eventId)) return; // idempotent (AT-27)
    list.push(Object.freeze({ ...event }));
    this.#evidence.set(event.learnerAlias, list);
    this.#reproject(event.learnerAlias, event.skillId);
  }

  /** Append a correction (reviewer/producer) and reproject — history is preserved (LRN-003, AT-25). */
  correct(actor: ActorContext, learnerAlias: string, correction: EvidenceCorrectionRecord): void {
    if (actor.actorType !== 'evidence_producer' && actor.actorType !== 'content_validator') {
      throw new DomainError('FORBIDDEN_ROLE', 'correction requires an authorised reviewer');
    }
    const events = this.#evidence.get(learnerAlias) ?? [];
    const target = events.find((e) => e.eventId === correction.targetEventId);
    if (!target) throw new DomainError('NOT_FOUND', 'target evidence event does not exist');
    const list = this.#corrections.get(learnerAlias) ?? [];
    list.push(Object.freeze({ ...correction }));
    this.#corrections.set(learnerAlias, list);
    this.#reproject(learnerAlias, target.skillId);
  }

  /** Current promoted state for a skill (UNASSESSED when none). */
  getState(learnerAlias: string, skillId: string): StoredProjection {
    return (
      this.#projections.get(key(learnerAlias, skillId)) ?? {
        projectionVersion: 0,
        state: 'UNASSESSED',
      }
    );
  }

  /** Fresh shadow projection (pure replay) — never mutates stored state (C-09). */
  shadow(learnerAlias: string, skillId: string): SkillProjection {
    return projectShadow(
      learnerAlias,
      skillId,
      this.#evidence.get(learnerAlias) ?? [],
      this.#corrections.get(learnerAlias) ?? [],
      this.#policy,
    );
  }

  /**
   * Reconciliation check (AT-60): recompute the projection from evidence and
   * compare to the stored one. A mismatch means the stored projection has drifted
   * from what the evidence supports (a regression) — surfaced, not silently kept.
   */
  reconcile(
    learnerAlias: string,
    skillId: string,
  ): { readonly match: boolean; readonly stored: SkillState; readonly recomputed: SkillState } {
    const stored = this.getState(learnerAlias, skillId).state;
    const recomputed = this.shadow(learnerAlias, skillId).state;
    return { match: stored === recomputed, stored, recomputed };
  }

  /**
   * Conceptual-mastery projection (ER-03) — a pure replay of the SAME immutable
   * ledger, honouring retraction corrections, never a separate store. Only
   * events that carry a conceptual `evidenceDimension` + `itemFamilyId` count;
   * everything else is ignored. Mastery stays derived-from-evidence — there is
   * no path to set it directly (TM-07/08). Pass `gradeTarget` to use the
   * fail-closed assessed-core gate (a grade-specific INDEPENDENT/RETAINED claim
   * requires it); omit it for the generic, internal projection.
   */
  conceptualProjection(
    learnerAlias: string,
    policy: ConceptualSkillPolicy,
    opts: { readonly gradeTarget?: number } = {},
  ): ConceptualMasteryResult {
    const retracted = new Set(
      (this.#corrections.get(learnerAlias) ?? [])
        .filter((c) => c.retract)
        .map((c) => c.targetEventId),
    );
    const events: ConceptualEvidence[] = (this.#evidence.get(learnerAlias) ?? [])
      .filter(
        (e) =>
          e.skillId === policy.skillId &&
          !retracted.has(e.eventId) &&
          e.evidenceDimension !== undefined &&
          e.itemFamilyId !== undefined,
      )
      .map((e) => ({
        eventId: e.eventId,
        skillId: e.skillId,
        gradeTarget: e.gradeTarget ?? 0,
        dimension: e.evidenceDimension!,
        correct: e.correct,
        assistanceBand: e.assistanceBand,
        mode: e.mode,
        representation: e.representation,
        itemFamilyId: e.itemFamilyId!,
        ...(e.sessionId ? { sessionId: e.sessionId } : {}),
        observedAt: e.observedAt,
      }));
    return opts.gradeTarget === undefined
      ? evaluateConceptualMastery(events, policy)
      : evaluateAssessedCoreMastery(events, policy, opts.gradeTarget);
  }

  /** Internal: replay → promote via mastery-authority (projector-only, replay-derived). */
  #reproject(learnerAlias: string, skillId: string): void {
    const shadow = this.shadow(learnerAlias, skillId);
    const current = this.getState(learnerAlias, skillId);
    if (shadow.state === current.state) return; // no change, no version churn
    const result = promoteProjection(PROJECTOR, current.projectionVersion, {
      learnerAlias,
      skillId,
      fromProjectionVersion: current.projectionVersion,
      toState: shadow.state,
      derivedFromShadowReplay: true,
      approvedPolicyVersion: shadow.policyVersion,
    });
    this.#projections.set(key(learnerAlias, skillId), {
      projectionVersion: result.projectionVersion,
      state: result.state,
    });
  }
}
