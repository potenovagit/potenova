import { describe, it, expect } from 'vitest';
import {
  startOnboarding,
  beginSelection,
  selectLearner,
  confirmSelection,
  assertSameLearner,
  type LearnerCard,
} from '@potenova/learner-ux';
import { isDomainError } from '@potenova/contracts';

const roster: LearnerCard[] = [
  { learnerId: 'lnr-a', nickname: 'Star', ageBand: 'primary' },
  { learnerId: 'lnr-b', nickname: 'Comet', ageBand: 'junior' },
];

describe('onboarding / learner selection (AT-03)', () => {
  it('walks WELCOME -> SELECT_LEARNER -> CONFIRM -> READY', () => {
    let s = startOnboarding();
    expect(s.step).toBe('WELCOME');
    s = beginSelection(s);
    s = selectLearner(s, 'lnr-a', roster);
    expect(s.step).toBe('CONFIRM');
    s = confirmSelection(s);
    expect(s.step).toBe('READY');
    expect(s.selectedLearnerId).toBe('lnr-a');
  });

  it('refuses a learner that is not on the family roster', () => {
    try {
      selectLearner(beginSelection(startOnboarding()), 'lnr-x', roster);
      throw new Error('expected NOT_FOUND');
    } catch (e) {
      expect(isDomainError(e) && e.code).toBe('NOT_FOUND');
    }
  });

  it('AT-03: a cross-learner payload is refused in a learner view (sibling isolation)', () => {
    expect(() => assertSameLearner('lnr-a', 'lnr-a')).not.toThrow();
    try {
      assertSameLearner('lnr-a', 'lnr-b');
      throw new Error('expected FORBIDDEN_ROLE');
    } catch (e) {
      expect(isDomainError(e) && e.code).toBe('FORBIDDEN_ROLE');
    }
  });

  it('cannot confirm without a selection', () => {
    try {
      confirmSelection(startOnboarding());
      throw new Error('expected POLICY_BLOCKED');
    } catch (e) {
      expect(isDomainError(e) && e.code).toBe('POLICY_BLOCKED');
    }
  });
});
