import { describe, it, expect } from 'vitest';
import { selectLesson, LESSONS, ANY, type Lesson } from '@potenova/curriculum';

describe('teaching library selection', () => {
  it('every seeded lesson is approved with a signed ref (servable)', () => {
    for (const l of LESSONS) {
      expect(l.approved).toBe(true);
      expect(l.approvalRef).not.toBeNull();
    }
  });

  it('picks the misconception-specific lesson when the misconception matches', () => {
    const l = selectLesson({
      skillId: 'SK-FR-compare',
      misconceptionId: 'MC-FR-denom-size',
      representation: 'area-model',
    });
    expect(l?.lessonId).toBe('LS-FR-compare-denom-bars');
  });

  it('falls back to the skill default when the misconception is unknown or absent', () => {
    const none = selectLesson({ skillId: 'SK-FR-compare' });
    expect(none?.lessonId).toBe('LS-FR-compare-default');
    const other = selectLesson({ skillId: 'SK-FR-compare', misconceptionId: 'MC-XX-nope' });
    expect(other?.lessonId).toBe('LS-FR-compare-default');
  });

  it('never shows a lesson built for a different misconception', () => {
    // The denom lesson is specific; a mismatched misconception must not select it.
    const l = selectLesson({ skillId: 'SK-FR-compare', misconceptionId: 'MC-XX-nope' });
    expect(l?.misconceptionId).toBe(ANY);
  });

  it('returns null for a skill with no lessons', () => {
    expect(selectLesson({ skillId: 'SK-UNKNOWN' })).toBeNull();
  });

  it('never returns an unapproved or unsigned lesson', () => {
    const lib: Lesson[] = [
      {
        lessonId: 'LS-bad-unapproved',
        skillId: 'SK-FR-compare',
        misconceptionId: 'MC-FR-denom-size',
        representation: 'area-model',
        approved: false,
        approvalRef: null,
        version: 'x',
        title: 't',
        intro: 'i',
        steps: [],
        takeaway: 'k',
      },
    ];
    expect(
      selectLesson({ skillId: 'SK-FR-compare', misconceptionId: 'MC-FR-denom-size' }, lib),
    ).toBeNull();
  });
});
