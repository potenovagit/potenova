/**
 * Pure presentation helpers (no React, no DOM) so they can be unit-tested in a
 * plain Node environment. These turn the API's derived standings into
 * parent/child-friendly copy — they never compute mastery themselves.
 */

/** Mirrors `SkillStanding` from the diagnostic domain (DIA-008). */
export type Standing = 'unknown' | 'emerging' | 'developing' | 'demonstrated' | 'needs_review';

export function standingLabel(s: string): string {
  switch (s) {
    case 'demonstrated':
      return 'Demonstrated';
    case 'developing':
      return 'Developing';
    case 'emerging':
      return 'Emerging';
    case 'needs_review':
      return 'Needs a closer look';
    case 'unknown':
      return 'Not yet assessed';
    default:
      return s.replace(/_/g, ' ');
  }
}

/** A coarse tone used only for colour; never shown as a number to a child. */
export function standingTone(s: string): 'good' | 'mid' | 'low' {
  if (s === 'demonstrated') return 'good';
  if (s === 'developing' || s === 'emerging') return 'mid';
  return 'low';
}

export function confidencePct(confidence: number): string {
  const clamped = Math.max(0, Math.min(1, confidence));
  return `${Math.round(clamped * 100)}%`;
}

/** Age-band layout profile (LUX-001): bigger targets and copy for younger learners. */
export function bandForGrade(grade: number): 'primary' | 'junior' | 'intermediate' {
  if (grade <= 3) return 'primary';
  if (grade <= 6) return 'junior';
  return 'intermediate';
}
