import { describe, it, expect } from 'vitest';
import { applySchoolTopic, activateTestPrep, applyEmphasis } from '@potenova/parent';
import { isDomainError } from '@potenova/contracts';

describe('school alignment + emphasis (PAR-004/005/008; AT-29/30)', () => {
  it('PAR-004: a school topic influences priority but never mastery', () => {
    const e = applySchoolTopic({ topicText: 'fractions unit', mappedSkillIds: ['SK-FR-compare'] });
    expect(e.reasonCode).toBe('SCHOOL_ALIGNMENT');
    expect(e.affectsMastery).toBe(false);
    expect(e.prioritizedSkillIds).toEqual(['SK-FR-compare']);
  });

  it('AT-30: test prep is temporary and reverts to the mastery roadmap', () => {
    const tp = activateTestPrep(['SK-FR-equiv']);
    expect(tp.active).toBe(true);
    expect(tp.revertsToMastery).toBe(true);
  });

  it('AT-29: emphasis applies only within entitled subjects', () => {
    expect(applyEmphasis('more_math', ['math', 'english']).emphasis).toBe('more_math');
    try {
      applyEmphasis('more_english', ['math']);
      throw new Error('expected ENTITLEMENT_INACTIVE');
    } catch (e) {
      expect(isDomainError(e) && e.code).toBe('ENTITLEMENT_INACTIVE');
    }
  });
});
