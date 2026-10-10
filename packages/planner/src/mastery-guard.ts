import { MIN_TRUSTED_RECOGNITION } from '@potenova/learner-state';

/**
 * Mastery-integrity guards the planner must honour (AT-28/56; Non-negotiable:
 * tutor/parent/billing never set mastery).
 *
 * The planner proposes and teaches; it never writes mastery. Promotion happens
 * only through @potenova/domain-core mastery-authority, fed by immutable evidence
 * and shadow replay. These helpers make the two LOCKED edge cases explicit.
 */

export interface ParentMasteryAssertion {
  readonly accepted: false;
  readonly recordAs: 'CONTEXT_ONLY';
  readonly requiresIndependentCheck: true;
}

/**
 * AT-56: a parent asking to mark a skill "mastered" is recorded as context only
 * and still requires an independent mastery check. It never mutates mastery.
 */
export function parentMasteryAssertionIsContextOnly(): ParentMasteryAssertion {
  return { accepted: false, recordAs: 'CONTEXT_ONLY', requiresIndependentCheck: true };
}

/**
 * AT-28: a low-confidence voice/vision transcript must not drive a confident
 * grade change. Returns whether the recognition is trusted enough to grade on.
 */
export function transcriptUsableForGrading(recognitionConfidence: number): boolean {
  return recognitionConfidence >= MIN_TRUSTED_RECOGNITION;
}
