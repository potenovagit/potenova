/**
 * The "active learner" is the family/guardian/learner the caregiver just set up
 * in onboarding, stashed in localStorage so the dashboard and learner routes can
 * preload without a backend session store (the real app gets this from the IdP
 * session). Reading is best-effort and always try/caught — a private window or
 * a direct visit simply yields null, and the route shows a connect state.
 */

export type Focus = 'math' | 'english' | 'both';

export interface ActiveLearner {
  familyId: string;
  guardianId: string;
  learnerId: string;
  nickname: string;
  grade: number;
  focus: Focus;
  modalities?: { voice: boolean; photo: boolean };
}

export function readActive(): ActiveLearner | null {
  try {
    const raw = localStorage.getItem('potenova.active');
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<ActiveLearner>;
    if (!v.familyId || !v.guardianId || !v.learnerId) return null;
    return {
      familyId: v.familyId,
      guardianId: v.guardianId,
      learnerId: v.learnerId,
      nickname: v.nickname ?? 'your child',
      grade: typeof v.grade === 'number' ? v.grade : 4,
      focus: (v.focus as Focus) ?? 'both',
      modalities: v.modalities,
    };
  } catch {
    return null;
  }
}
