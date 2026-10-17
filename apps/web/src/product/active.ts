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

/**
 * Baseline bookkeeping (per learner + subject), kept in localStorage so a child
 * isn't re-baselined every session. `done` marks a completed baseline; `run`
 * holds the id of an in-flight run so an interrupted baseline can resume. All
 * best-effort: a storage failure just means the baseline runs (or re-runs),
 * which is safe — it never fabricates mastery, only seeds placement.
 */
type BaselineState = { done?: Record<string, boolean>; run?: Record<string, string> };
const BASELINE_KEY = 'potenova.baseline';
const mk = (learnerId: string, subject: string): string => `${learnerId}:${subject}`;

function readBaselineState(): BaselineState {
  try {
    const raw = localStorage.getItem(BASELINE_KEY);
    return raw ? (JSON.parse(raw) as BaselineState) : {};
  } catch {
    return {};
  }
}

function writeBaselineState(s: BaselineState): void {
  try {
    localStorage.setItem(BASELINE_KEY, JSON.stringify(s));
  } catch {
    /* storage disabled — baseline simply re-runs next time */
  }
}

export function isBaselineDone(learnerId: string, subject: string): boolean {
  return readBaselineState().done?.[mk(learnerId, subject)] === true;
}

export function markBaselineDone(learnerId: string, subject: string): void {
  const s = readBaselineState();
  s.done = { ...(s.done ?? {}), [mk(learnerId, subject)]: true };
  if (s.run) delete s.run[mk(learnerId, subject)];
  writeBaselineState(s);
}

export function stashBaselineRun(learnerId: string, subject: string, runId: string): void {
  const s = readBaselineState();
  s.run = { ...(s.run ?? {}), [mk(learnerId, subject)]: runId };
  writeBaselineState(s);
}

export function readBaselineRun(learnerId: string, subject: string): string | null {
  return readBaselineState().run?.[mk(learnerId, subject)] ?? null;
}

export function clearBaselineRun(learnerId: string, subject: string): void {
  const s = readBaselineState();
  if (s.run) {
    delete s.run[mk(learnerId, subject)];
    writeBaselineState(s);
  }
}
