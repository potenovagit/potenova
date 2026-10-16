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

/** Plain-language label for a planner/plan reason code (parent-facing). */
export function reasonCodeLabel(code: string): string {
  switch (code) {
    case 'REVALIDATION_REQUIRED':
      return 'Re-checking a skill that slipped';
    case 'PREREQUISITE_REMEDIATION':
      return 'Building a foundation first';
    case 'LOW_CONFIDENCE_VERIFICATION':
      return 'Checking this is solid';
    case 'MASTERY_CHECK':
      return 'Confirming mastery';
    case 'REVIEW_DUE':
      return 'Due for review';
    case 'TRANSFER_CHECK':
      return 'Ready for a challenge';
    case 'ADVANCEMENT':
      return 'Moving ahead';
    case 'SCHOOL_ALIGNMENT':
      return 'Aligning with school';
    case 'PARENT_PREFERENCE':
      return 'Following your focus';
    case 'SAFETY_LIMIT':
      return 'Paused by a limit';
    default:
      return code.replace(/_/g, ' ').toLowerCase();
  }
}

/** A short, plain description of a usage-cap decision for a parent. */
export function usageDecisionLabel(kind: string): string {
  switch (kind) {
    case 'ALLOW':
      return 'Full time allowed';
    case 'SHORTEN':
      return 'Shortened to fit the limit';
    case 'STOP':
      return 'Daily limit reached';
    case 'BLOCKED_UNCONFIGURED':
      return 'No approved time limit set';
    default:
      return kind.replace(/_/g, ' ').toLowerCase();
  }
}

/** Format a minutes value, or an em dash when there is no parent limit. */
export function minutesLabel(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return `${n} min`;
}

/** A fail-closed policy's state as a reviewer-facing status + tone. */
export function policyState(
  approved: boolean,
  configured = true,
): {
  label: string;
  tone: 'good' | 'mid' | 'low';
} {
  if (!configured) return { label: 'Not configured', tone: 'low' };
  if (!approved) return { label: 'Draft — pending approval', tone: 'mid' };
  return { label: 'Approved', tone: 'good' };
}

/** Model registry status → reviewer label + tone (never implies production use). */
export function modelStatusTone(status: string | null | undefined): {
  label: string;
  tone: 'good' | 'mid' | 'low';
} {
  switch (status) {
    case 'APPROVED':
      return { label: 'Approved', tone: 'good' };
    case 'SYNTHETIC_TESTING':
      return { label: 'Synthetic testing only', tone: 'mid' };
    case 'EVALUATED':
      return { label: 'Evaluated (not approved)', tone: 'mid' };
    case null:
    case undefined:
      return { label: 'None wired', tone: 'mid' };
    default:
      return { label: status.replace(/_/g, ' ').toLowerCase(), tone: 'mid' };
  }
}
