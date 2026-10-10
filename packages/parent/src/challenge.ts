import { DomainError } from '@potenova/contracts';
import type { EvidenceCorrectionRecord } from '@potenova/learner-state';

/**
 * Challenge / dispute flow (PAR-011/012; AT-25).
 *
 * A parent or child may challenge a question's correctness, feedback or marking.
 * The dispute triggers INDEPENDENT re-evaluation and does NOT penalize the
 * learner while pending (the disputed negative evidence is withheld from any
 * demotion). Resolution appends a provenance-stamped EvidenceCorrection and
 * triggers revalidation — it never sets mastery directly (PAR-012).
 */

export type ChallengeState = 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED';

export interface QualityCase {
  readonly caseId: string;
  readonly targetEventId: string;
  readonly raisedBy: 'parent' | 'child';
  readonly state: ChallengeState;
  /** While true, the disputed evidence is withheld from mastery demotion (AT-25). */
  readonly demotionWithheld: boolean;
}

export function openChallenge(
  caseId: string,
  targetEventId: string,
  raisedBy: 'parent' | 'child',
): QualityCase {
  return { caseId, targetEventId, raisedBy, state: 'OPEN', demotionWithheld: true };
}

export function beginReview(c: QualityCase): QualityCase {
  if (c.state !== 'OPEN') throw new DomainError('CONFLICT', 'challenge is not open');
  return { ...c, state: 'UNDER_REVIEW' };
}

export interface ChallengeResolution {
  readonly case: QualityCase;
  /** The appended correction (retract=true when the challenge is upheld). */
  readonly correction: EvidenceCorrectionRecord;
}

/**
 * Resolve a challenge by appending an EvidenceCorrection (never a direct mastery
 * write). `upheld` retracts the disputed observation from projection; either way
 * provenance is recorded and revalidation is left to the evidence engine.
 */
export function resolveChallenge(
  c: QualityCase,
  input: {
    readonly upheld: boolean;
    readonly reason: string;
    readonly correctionId: string;
    readonly at: string;
  },
): ChallengeResolution {
  if (c.state !== 'UNDER_REVIEW') {
    throw new DomainError('CONFLICT', 'challenge must be under review before resolution');
  }
  const correction: EvidenceCorrectionRecord = {
    correctionId: input.correctionId,
    targetEventId: c.targetEventId,
    reason: input.reason,
    retract: input.upheld,
    createdAt: input.at,
  };
  return {
    case: { ...c, state: 'RESOLVED', demotionWithheld: false },
    correction,
  };
}
