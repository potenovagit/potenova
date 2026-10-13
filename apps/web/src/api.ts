/**
 * Thin typed client for the Potenova API (services/api). The browser talks to the
 * API same-origin under `/api/*` (Vite proxies it in dev). Auth here is the Stage-2
 * dev shim — the real app gets identity from the managed IdP (ADR-0008); this app
 * just sets the actor headers the API already enforces.
 */

export interface ApiError {
  readonly code: string;
  readonly message: string;
  readonly status: number;
}

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? '/api';

interface CallOpts {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
}

export async function call<T>(path: string, opts: CallOpts = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      method: opts.method ?? 'GET',
      headers: { 'content-type': 'application/json', ...(opts.headers ?? {}) },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
  } catch {
    const err: ApiError = {
      code: 'NETWORK',
      message: 'Could not reach the API. Is it running on :8080?',
      status: 0,
    };
    throw err;
  }
  const text = await res.text();
  const data: unknown = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const rec = data as Record<string, unknown>;
    const err: ApiError = {
      code: typeof rec.code === 'string' ? rec.code : 'ERROR',
      message: typeof rec.message === 'string' ? rec.message : res.statusText,
      status: res.status,
    };
    throw err;
  }
  return data as T;
}

export function isApiError(e: unknown): e is ApiError {
  return typeof e === 'object' && e !== null && 'code' in e && 'status' in e;
}

/** Account-owner guardian headers (full mutation rights). */
export function guardianHeaders(familyId: string, guardianAlias: string): Record<string, string> {
  return {
    'x-actor-type': 'guardian',
    'x-actor-alias': guardianAlias,
    'x-guardian-role': 'owner',
    'x-family-alias': familyId,
  };
}

/** Evidence-producer headers. Only this actor type may write mastery evidence
 *  (never a parent/child/tutor-UI). In production the tutor engine is the producer;
 *  in this demo the web app stands in for it so you can watch the loop close. */
export function producerHeaders(familyId: string, learnerAlias: string): Record<string, string> {
  return {
    'x-actor-type': 'evidence_producer',
    'x-actor-alias': 'web-demo-producer',
    'x-family-alias': familyId,
    'x-learner-alias': learnerAlias,
  };
}

// ---- Typed endpoint wrappers -------------------------------------------------

export interface DashboardRow {
  skillId: string;
  standing: string;
  confidence: number;
  evidenceCount: number;
}
export interface NextFocus {
  skillId: string;
  reasonCode: string;
  explanation: string;
  exposesChainOfThought: boolean;
}
export interface SubjectGroup {
  subject: string;
  rows: DashboardRow[];
  nextFocus?: NextFocus;
}
export interface Dashboard {
  learnerAlias: string;
  rows: DashboardRow[];
  bySubject: SubjectGroup[];
}
export interface Projection {
  learnerAlias: string;
  skillId: string;
  confidence: number;
  evidenceCount: number;
  state?: string;
}

export const health = () => call<{ status: string }>('/healthz');

export const readiness = () =>
  call<{ status: string; environment: string; primaryRegion: string; modules: number }>('/readyz');

export const createFamily = (familyId: string, guardianId: string) =>
  call<{ familyId: string }>('/families', {
    method: 'POST',
    headers: guardianHeaders(familyId, guardianId),
    body: { familyId, marketRegion: 'ca-on', legalOwnerGuardianId: guardianId },
  });

export const grantConsent = (familyId: string, guardianId: string) =>
  call<{ grantId: string; state: string }>(`/families/${familyId}/consent`, {
    method: 'POST',
    headers: guardianHeaders(familyId, guardianId),
    body: {
      grantId: `cg-${Date.now()}`,
      purpose: 'child_learning',
      modality: 'text',
      version: 'v1',
    },
  });

export const addLearner = (
  familyId: string,
  guardianId: string,
  learnerId: string,
  nickname: string,
  grade: number,
) =>
  call<{ learnerId: string; ageBand: string }>(`/families/${familyId}/learners`, {
    method: 'POST',
    headers: guardianHeaders(familyId, guardianId),
    body: { learnerId, nickname, grade },
  });

export const getDashboard = (
  familyId: string,
  guardianId: string,
  learnerId: string,
  skills?: string[],
) =>
  call<Dashboard>(
    `/learners/${learnerId}/dashboard${
      skills && skills.length ? `?skills=${encodeURIComponent(skills.join(','))}` : ''
    }`,
    { headers: guardianHeaders(familyId, guardianId) },
  );

export const submitEvidence = (
  familyId: string,
  learnerId: string,
  skillId: string,
  correct: boolean,
) =>
  call<{ accepted: boolean; eventId: string }>(
    `/learners/${learnerId}/skills/${skillId}/evidence`,
    {
      method: 'POST',
      headers: producerHeaders(familyId, learnerId),
      body: {
        eventId: `e-${Date.now()}`,
        mode: 'independent_check',
        assistanceBand: 'A0',
        correct,
        representation: 'area-model',
        recognitionConfidence: 1,
        observedAt: new Date().toISOString(),
        curriculumReleaseId: 'REL-ONT-MATH-2020-draft',
        schemaVersion: 'evt-0.1',
      },
    },
  );

export const getProjection = (familyId: string, learnerId: string, skillId: string) =>
  call<{ projection: Projection }>(`/learners/${learnerId}/skills/${skillId}/projection`, {
    headers: producerHeaders(familyId, learnerId),
  });
