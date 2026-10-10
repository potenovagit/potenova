import { DomainError } from '@potenova/contracts';
import { homeworkAssistance } from '@potenova/learner-ux';
import type { WritingDimension } from './policy';

/**
 * Writing coach (Product §5; AI Learning §6; AT-19).
 *
 * Coaches across the rubric — ideas, organization, conventions, audience/purpose,
 * revision, independence — by explaining, questioning, modelling with SEPARATE
 * examples, and guiding revision. It must never become a ghostwriter: it does not
 * produce the child's submitted work. A "write it for me" request is redirected
 * to analogous coaching, reusing the WP-08 homework guard.
 */

export type CoachResponseKind =
  | 'explain'
  | 'ask_question'
  | 'model_separate_example'
  | 'guide_revision'
  | 'produce_submission';

/**
 * @throws DomainError POLICY_BLOCKED — producing the child's submitted work.
 */
export function assertNotGhostwriting(kind: CoachResponseKind): void {
  if (kind === 'produce_submission') {
    throw new DomainError(
      'POLICY_BLOCKED',
      'the writing coach must not produce the child’s submitted work',
    );
  }
}

export interface RubricFeedback {
  readonly dimension: WritingDimension;
  readonly kind: 'strength' | 'suggestion' | 'question';
  /** Invariant: coaching never carries rewritten submission text. */
  readonly rewritesSubmission: false;
}

/**
 * Produce rubric-aligned coaching for the given weak dimensions. Emits
 * suggestions/questions per dimension — never the rewritten text.
 */
export function coachWriting(weakDimensions: readonly WritingDimension[]): RubricFeedback[] {
  return weakDimensions.map(
    (dimension): RubricFeedback => ({ dimension, kind: 'suggestion', rewritesSubmission: false }),
  );
}

/** AT-19: a "write my essay" request becomes analogous coaching, not completion. */
export function writingHomeworkRequest(): {
  readonly mode: 'COACH_ANALOGOUS';
  readonly completesOriginal: false;
} {
  return homeworkAssistance({ completeOriginalRequested: true });
}
