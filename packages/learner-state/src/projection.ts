import type { SkillState } from '@potenova/domain-core';
import {
  type MasteryEvidence,
  type EvidenceCorrectionRecord,
  MIN_TRUSTED_RECOGNITION,
} from './evidence';
import { type MasteryPolicy, DRAFT_MASTERY_POLICY } from './policy';

/**
 * Pure mastery projection (WP-03).
 * Source: 05_AI_Learning_Evaluation.md §2 pseudo-logic; State machine 3.1.
 *
 * Given a learner's immutable evidence for ONE skill plus corrections, derive a
 * shadow projection. This is a pure function — it never mutates evidence or
 * stored state (C-09 ProjectShadow). Promotion of a stored projection happens
 * only through the learner-state authority (mastery-authority), fed by this.
 *
 * Core invariants enforced here:
 *  - no evidence → UNASSESSED, never "failed"/zero (AT-05)
 *  - assisted-only (A4/A5) success never reaches INDEPENDENT (AT-09)
 *  - INDEPENDENT needs diverse unaided evidence across representations (AT-10)
 *  - RETAINED needs a delayed independent retrieval (AT-11)
 *  - TRANSFERABLE needs unaided success in a novel (transfer) context (AT-12)
 *  - contradiction after mastery → REVALIDATION_REQUIRED, history preserved
 */

export interface SkillProjection {
  readonly learnerAlias: string;
  readonly skillId: string;
  readonly state: SkillState;
  readonly dimensions: {
    readonly independent: boolean;
    readonly retained: boolean;
    readonly transferable: boolean;
    readonly representationsCovered: number;
    readonly unaidedCorrect: number;
  };
  /** 0..1 — coverage/consistency based; low when evidence is thin. */
  readonly confidence: number;
  readonly policyVersion: string;
  readonly curriculumReleaseId: string | null;
  readonly evidenceCount: number;
}

function isUnaided(band: string, policy: MasteryPolicy): boolean {
  return policy.unaidedBands.includes(band);
}

/** Trusted evidence = complete, recognizable, and not retracted by a correction. */
function trustedEvents(
  events: readonly MasteryEvidence[],
  corrections: readonly EvidenceCorrectionRecord[],
): MasteryEvidence[] {
  const retracted = new Set(corrections.filter((c) => c.retract).map((c) => c.targetEventId));
  return events.filter(
    (e) => !retracted.has(e.eventId) && e.recognitionConfidence >= MIN_TRUSTED_RECOGNITION,
  );
}

export function projectShadow(
  learnerAlias: string,
  skillId: string,
  events: readonly MasteryEvidence[],
  corrections: readonly EvidenceCorrectionRecord[] = [],
  policy: MasteryPolicy = DRAFT_MASTERY_POLICY,
): SkillProjection {
  const scoped = trustedEvents(events, corrections).filter(
    (e) => e.learnerAlias === learnerAlias && e.skillId === skillId,
  );
  const releaseId =
    scoped.length > 0 ? (scoped[scoped.length - 1]?.curriculumReleaseId ?? null) : null;

  const base = {
    learnerAlias,
    skillId,
    policyVersion: policy.policyVersion,
    curriculumReleaseId: releaseId,
    evidenceCount: scoped.length,
  };

  // AT-05: no evidence is UNASSESSED, never a failure/zero.
  if (scoped.length === 0) {
    return {
      ...base,
      state: 'UNASSESSED',
      dimensions: {
        independent: false,
        retained: false,
        transferable: false,
        representationsCovered: 0,
        unaidedCorrect: 0,
      },
      confidence: 0,
    };
  }

  const unaidedCorrect = scoped.filter((e) => e.correct && isUnaided(e.assistanceBand, policy));
  const representations = new Set(unaidedCorrect.map((e) => e.representation));
  const representationsCovered = representations.size;

  const independent =
    unaidedCorrect.length >= policy.minUnaidedForIndependent &&
    representationsCovered >= policy.minRepresentationsForIndependent;

  // Retention: a delayed, independent retrieval after independence was first shown (AT-11).
  const firstUnaidedAt =
    unaidedCorrect.length > 0
      ? Math.min(...unaidedCorrect.map((e) => Date.parse(e.observedAt)))
      : Number.POSITIVE_INFINITY;
  const retained =
    independent &&
    scoped.some(
      (e) =>
        e.mode === 'retention_check' &&
        e.correct &&
        isUnaided(e.assistanceBand, policy) &&
        Date.parse(e.observedAt) - firstUnaidedAt >= policy.retentionDelayMs,
    );

  // Transfer: unaided success in a novel context (AT-12).
  const transferable =
    (retained || independent) &&
    scoped.some(
      (e) => e.mode === 'transfer_check' && e.correct && isUnaided(e.assistanceBand, policy),
    );

  // Contradiction after mastery → REVALIDATION_REQUIRED, prior history preserved.
  const contradicted =
    independent &&
    scoped.some(
      (e) =>
        !e.correct &&
        isUnaided(e.assistanceBand, policy) &&
        e.mode === 'independent_check' &&
        Date.parse(e.observedAt) > firstUnaidedAt,
    );

  let state: SkillState;
  if (contradicted) state = 'REVALIDATION_REQUIRED';
  else if (transferable) state = 'TRANSFERABLE';
  else if (retained) state = 'RETAINED';
  else if (independent) state = 'INDEPENDENT';
  else if (unaidedCorrect.length > 0 || scoped.some((e) => e.correct)) state = 'DEVELOPING';
  else state = 'EMERGING';

  // Placeholder confidence: grows with unaided volume + representation diversity (ER-03).
  const confidence = Math.min(
    1,
    unaidedCorrect.length / Math.max(1, policy.minUnaidedForIndependent) / 2 +
      representationsCovered / Math.max(1, policy.minRepresentationsForIndependent) / 2,
  );

  return {
    ...base,
    state,
    dimensions: {
      independent,
      retained,
      transferable,
      representationsCovered,
      unaidedCorrect: unaidedCorrect.length,
    },
    confidence: Number(confidence.toFixed(2)),
  };
}
