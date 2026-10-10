import { DomainError } from '@potenova/contracts';
import type { AgeBand } from '@potenova/identity';

/**
 * Child onboarding / learner selection (WP-08; AT-03 adjacent).
 *
 * A device shows the family's learners by nickname only — never PII — and the
 * child picks one to enter. Selection is constrained to the family roster, and a
 * learner's view carries only that learner's context (sibling isolation).
 */

export const ONBOARDING_STEPS = ['WELCOME', 'SELECT_LEARNER', 'CONFIRM', 'READY'] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

/** What a selection card may show — nickname + band only, no PII. */
export interface LearnerCard {
  readonly learnerId: string;
  readonly nickname: string;
  readonly ageBand: AgeBand;
}

export interface OnboardingState {
  readonly step: OnboardingStep;
  readonly selectedLearnerId: string | null;
}

export function startOnboarding(): OnboardingState {
  return { step: 'WELCOME', selectedLearnerId: null };
}

export function beginSelection(state: OnboardingState): OnboardingState {
  return { ...state, step: 'SELECT_LEARNER' };
}

/**
 * Select a learner from the family roster.
 *
 * @throws DomainError NOT_FOUND — learner is not on this family's roster.
 */
export function selectLearner(
  state: OnboardingState,
  learnerId: string,
  roster: readonly LearnerCard[],
): OnboardingState {
  if (!roster.some((c) => c.learnerId === learnerId)) {
    throw new DomainError('NOT_FOUND', 'selected learner is not on the family roster');
  }
  return { step: 'CONFIRM', selectedLearnerId: learnerId };
}

export function confirmSelection(state: OnboardingState): OnboardingState {
  if (!state.selectedLearnerId) {
    throw new DomainError('POLICY_BLOCKED', 'no learner selected');
  }
  return { ...state, step: 'READY' };
}

/**
 * Sibling isolation guard (AT-03): any payload rendered in a learner's view must
 * belong to that learner. A cross-learner payload is refused, never shown.
 *
 * @throws DomainError FORBIDDEN_ROLE — payload belongs to a different learner.
 */
export function assertSameLearner(viewLearnerId: string, payloadLearnerId: string): void {
  if (viewLearnerId !== payloadLearnerId) {
    throw new DomainError(
      'FORBIDDEN_ROLE',
      'cross-learner context is not permitted in a learner view',
    );
  }
}
