import { DomainError } from '@potenova/contracts';
import type { SubjectEmphasis } from './policy';

/**
 * School alignment + subject emphasis (PAR-004/005/008; AT-29/30).
 *
 * - A parent school topic maps to curriculum priorities but NEVER to mastery
 *   directly (PAR-004): school input influences the planner reason code
 *   SCHOOL_ALIGNMENT, not the learner's evidence.
 * - Test/Assignment Prep temporarily reprioritizes, then the planner returns to
 *   the broader mastery roadmap (PAR-005; AT-30).
 * - Subject emphasis changes allocation only within purchased subjects (PAR-008;
 *   AT-29).
 */

export interface SchoolTopicInput {
  readonly topicText: string;
  /** Curriculum expectations the topic maps to (reviewed mapping, upstream). */
  readonly mappedSkillIds: readonly string[];
}

export interface SchoolAlignmentEffect {
  readonly reasonCode: 'SCHOOL_ALIGNMENT';
  /** Invariant (PAR-004): school input never writes mastery. */
  readonly affectsMastery: false;
  readonly prioritizedSkillIds: readonly string[];
}

export function applySchoolTopic(input: SchoolTopicInput): SchoolAlignmentEffect {
  return {
    reasonCode: 'SCHOOL_ALIGNMENT',
    affectsMastery: false,
    prioritizedSkillIds: input.mappedSkillIds,
  };
}

export interface TestPrepMode {
  readonly active: true;
  /** Invariant (AT-30): prep is temporary; the planner reverts to the mastery roadmap. */
  readonly revertsToMastery: true;
  readonly focusSkillIds: readonly string[];
}

export function activateTestPrep(focusSkillIds: readonly string[]): TestPrepMode {
  return { active: true, revertsToMastery: true, focusSkillIds };
}

/**
 * Apply a subject-emphasis preference, constrained to entitled subjects (AT-29).
 *
 * @throws DomainError ENTITLEMENT_INACTIVE — emphasis names a subject the family
 *         is not entitled to.
 */
export function applyEmphasis(
  emphasis: SubjectEmphasis,
  entitledSubjects: readonly ('math' | 'english')[],
): { readonly emphasis: SubjectEmphasis; readonly appliesTo: readonly ('math' | 'english')[] } {
  if (emphasis === 'more_math' && !entitledSubjects.includes('math')) {
    throw new DomainError('ENTITLEMENT_INACTIVE', 'Math emphasis requires a Math entitlement');
  }
  if (emphasis === 'more_english' && !entitledSubjects.includes('english')) {
    throw new DomainError(
      'ENTITLEMENT_INACTIVE',
      'English emphasis requires an English entitlement',
    );
  }
  return { emphasis, appliesTo: entitledSubjects };
}
