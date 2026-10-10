/**
 * Safe feedback + homework-help guard (WP-08; AT-19; DIA-011 tone).
 *
 * Feedback to a child is supportive and low-stakes — never shaming, never a
 * "failure" label, and without excessive reassurance. A request to "just solve
 * my homework" is always redirected to coaching an ANALOGOUS concept; the tutor
 * never completes the child's submitted work (AI Learning §6).
 */

export type Outcome = 'correct' | 'incorrect' | 'partial' | 'stopped';

export interface Feedback {
  readonly tone: 'supportive' | 'neutral' | 'encouraging';
  /** Invariant: feedback is never shaming. */
  readonly shaming: false;
  /** A constructive next step when there is one; null for a neutral acknowledgement. */
  readonly nextStep: 'try_another_representation' | 'keep_going' | 'resume_anytime' | null;
}

export function feedbackFor(outcome: Outcome): Feedback {
  switch (outcome) {
    case 'correct':
      return { tone: 'supportive', shaming: false, nextStep: 'keep_going' };
    case 'partial':
      return { tone: 'encouraging', shaming: false, nextStep: 'keep_going' };
    case 'incorrect':
      return { tone: 'encouraging', shaming: false, nextStep: 'try_another_representation' };
    case 'stopped':
      return { tone: 'neutral', shaming: false, nextStep: 'resume_anytime' };
    default: {
      const _never: never = outcome;
      void _never;
      return { tone: 'neutral', shaming: false, nextStep: null };
    }
  }
}

export interface HomeworkAssistance {
  readonly mode: 'COACH_ANALOGOUS';
  /** Invariant: the tutor never completes the child's own submitted work. */
  readonly completesOriginal: false;
}

/** AT-19: a "solve it for me" request yields analogous coaching, not completion. */
export function homeworkAssistance(_request: {
  readonly completeOriginalRequested: boolean;
}): HomeworkAssistance {
  return { mode: 'COACH_ANALOGOUS', completesOriginal: false };
}
