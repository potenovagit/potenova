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

// ---- Guardian sign-in exchange (ADR-0008) -----------------------------------

/**
 * The Potenova session token from the last guardian sign-in. In `jwt`-mode the
 * API verifies it (Bearer); in the Stage-2 dev/header mode it is ignored and the
 * x-actor-* headers carry identity — so sending both keeps the flow working in
 * either deployment. Kept in memory only (never persisted).
 */
let sessionToken: string | null = null;

export interface SignInResult {
  readonly token: string;
  readonly tokenType: string;
  readonly expiresAt: string;
  readonly provisioned: boolean;
  readonly actor: {
    readonly actorType: 'guardian';
    readonly guardianId: string;
    readonly familyId: string;
    readonly role: 'owner';
    readonly stepUp: boolean;
  };
}

/**
 * Exchange a verified IdP identity for a Potenova session, provisioning the
 * guardian's family on first sign-in. In this synthetic Stage-2 flow the IdP
 * subject stands in for an Entra-verified guardian; the server owns the
 * provisioning and returns the real family/guardian ids the rest of onboarding
 * uses. Fail-closed in production (a real verified token is required there).
 */
export const signIn = async (idpSubject: string): Promise<SignInResult> => {
  const r = await call<SignInResult>('/auth/session', {
    method: 'POST',
    body: { idpSubject },
  });
  sessionToken = r.token;
  return r;
};

/** Account-owner guardian headers (full mutation rights). Carries the session
 *  Bearer token when signed in, so the same call authenticates under jwt-mode. */
export function guardianHeaders(familyId: string, guardianAlias: string): Record<string, string> {
  return {
    'x-actor-type': 'guardian',
    'x-actor-alias': guardianAlias,
    'x-guardian-role': 'owner',
    'x-family-alias': familyId,
    ...(sessionToken ? { authorization: `Bearer ${sessionToken}` } : {}),
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
  cue?: string;
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

// ---- Child session flow ------------------------------------------------------

/** Child-actor headers — the learner working their own session. */
export function childHeaders(familyId: string, learnerId: string): Record<string, string> {
  return {
    'x-actor-type': 'child',
    'x-actor-alias': learnerId,
    'x-family-alias': familyId,
  };
}

/** Billing-service headers — the demo stands in for the payment provider so a
 *  session's entitlement precondition can be satisfied over HTTP. */
export function billingHeaders(familyId: string): Record<string, string> {
  return {
    'x-actor-type': 'billing_service',
    'x-actor-alias': 'web-demo-billing',
    'x-family-alias': familyId,
  };
}

export interface SessionNext {
  skillId: string;
  reasonCode: string;
  explanation: string;
  blockedSkillId: string | null;
  defaultTaskId: string | null;
  plannerPolicyVersion: string;
}
export interface SessionBudget {
  maxItems: number;
  itemsDelivered: number;
  itemsRemaining: number;
  itemCeilingReached: boolean;
  maxNewConcepts: number;
  conceptsIntroduced: number;
  conceptsRemaining: number;
  reason: string;
  policyVersion: string;
}
export interface StartedSession {
  session: { sessionId: string; state: string; subject: string };
  subject?: string;
  strand?: string;
  next: SessionNext;
  budget: SessionBudget;
  allowedMinutes: number;
  breakAfterMinutes?: number;
  usage?: { kind: string; reasonCodes: string[] };
}
export interface DeliveredTask {
  taskId: string;
  skillId: string;
  question: string;
  options: string[];
}
export interface Hint {
  skillId: string;
  level: number;
  misconceptionId: string;
  strategyId: string;
  message: string;
}
export interface StallCoaching {
  stalled: boolean;
  strategy: string;
  suggestedSkillId?: string;
  suggestedTaskId?: string;
  suggestedRepresentation?: string;
  message: string;
}
export interface SessionSummary {
  sessionId: string;
  subject: string;
  state: string;
  observed: {
    attempts: number;
    correct: number;
    bySkill: { skillId: string; attempts: number; correct: number; representations: string[] }[];
  };
  mastery: {
    skillId: string;
    projection: { state?: string; confidence: number; dimensions?: { independent: boolean } };
  }[];
  rationale: { nextObjective: { skillId: string; reasonCode: string; explanation: string } };
  note: string;
}
export interface AnswerResult {
  graded: boolean;
  correct?: boolean;
  skillId?: string;
  projection?: Projection;
  next?: SessionNext;
  budget?: SessionBudget;
  sessionComplete?: boolean;
  completionReason?: string;
  summary?: SessionSummary;
  reviewed?: boolean;
  coaching?: StallCoaching;
  hint?: Hint;
  action?: string;
}

/** Demo-activate the family's entitlement via the billing callback (idempotent). */
export const activateEntitlement = (familyId: string) =>
  call<{ applied: boolean }>('/billing/callbacks', {
    method: 'POST',
    headers: billingHeaders(familyId),
    body: {
      channel: 'web-demo',
      transactionId: `demo-${Date.now()}`,
      familyId,
      kind: 'grant',
    },
  });

export const startSession = (familyId: string, learnerId: string, subject: 'math' | 'english') =>
  call<StartedSession>(`/learners/${learnerId}/sessions`, {
    method: 'POST',
    headers: childHeaders(familyId, learnerId),
    body: { subject, requestedMinutes: 15 },
  });

export const getTask = (familyId: string, learnerId: string, sessionId: string, taskId: string) =>
  call<DeliveredTask>(
    `/learners/${learnerId}/sessions/${sessionId}/task?taskId=${encodeURIComponent(taskId)}`,
    { method: 'POST', headers: childHeaders(familyId, learnerId), body: {} },
  );

export const submitAnswer = (
  familyId: string,
  learnerId: string,
  sessionId: string,
  body: { clientSubmissionId: string; taskId: string; answer: string; representation: string },
) =>
  call<AnswerResult>(`/learners/${learnerId}/sessions/${sessionId}/answer`, {
    method: 'POST',
    headers: childHeaders(familyId, learnerId),
    body,
  });

// ---- "Learn it" teaching library --------------------------------------------

export type LessonStep =
  | { kind: 'say'; text: string }
  | { kind: 'bars'; label: string; filled: number; total: number };
export interface Lesson {
  lessonId: string;
  skillId: string;
  misconceptionId: string;
  representation: string;
  approved: boolean;
  approvalRef: string | null;
  version: string;
  title: string;
  intro: string;
  steps: LessonStep[];
  takeaway: string;
}

/** Fetch the approved worked explanation for a skill, selected to the child's
 *  just-shown misconception (and representation, when known). Returns null when
 *  nothing approved matches — the caller shows a minimal fallback, never
 *  anything unvetted. */
export const getLesson = (
  familyId: string,
  learnerId: string,
  skillId: string,
  opts?: { misconception?: string | null; representation?: string | null },
) => {
  const q = new URLSearchParams();
  if (opts?.misconception) q.set('misconception', opts.misconception);
  if (opts?.representation) q.set('representation', opts.representation);
  const qs = q.toString();
  return call<{ lesson: Lesson | null }>(
    `/learners/${learnerId}/lessons/${encodeURIComponent(skillId)}${qs ? `?${qs}` : ''}`,
    { headers: childHeaders(familyId, learnerId) },
  );
};

/** Grant the per-modality consents the multimodal answer path requires. */
export const grantMultimodalConsent = (familyId: string, guardianId: string) =>
  Promise.all([
    call(`/families/${familyId}/consent`, {
      method: 'POST',
      headers: guardianHeaders(familyId, guardianId),
      body: {
        grantId: `cg-v-${Date.now()}`,
        purpose: 'voice_interaction',
        modality: 'voice',
        version: 'v1',
      },
    }),
    call(`/families/${familyId}/consent`, {
      method: 'POST',
      headers: guardianHeaders(familyId, guardianId),
      body: {
        grantId: `cg-i-${Date.now()}`,
        purpose: 'vision_upload',
        modality: 'vision',
        version: 'v1',
      },
    }),
  ]);

export const submitMultimodalAnswer = (
  familyId: string,
  learnerId: string,
  sessionId: string,
  body: {
    clientSubmissionId: string;
    taskId: string;
    modality: 'voice' | 'vision';
    mediaRef: string;
  },
) =>
  call<AnswerResult>(`/learners/${learnerId}/sessions/${sessionId}/answer/multimodal`, {
    method: 'POST',
    headers: childHeaders(familyId, learnerId),
    body,
  });

export const startSessionStrand = (
  familyId: string,
  learnerId: string,
  subject: 'math' | 'english',
  strand?: string,
) =>
  call<StartedSession>(`/learners/${learnerId}/sessions`, {
    method: 'POST',
    headers: childHeaders(familyId, learnerId),
    body: { subject, strand, requestedMinutes: 15 },
  });

// ---- Guardian controls (parent preferences) ---------------------------------

export interface GuardianPreference {
  learnerAlias: string;
  focusSubject?: string | null;
  focusStrand?: string | null;
  focusSkillId?: string | null;
  maxDailyMinutes?: number | null;
  maxContinuousMinutes?: number | null;
}

export const getPreferences = (familyId: string, guardianId: string, learnerId: string) =>
  call<{ preference: GuardianPreference }>(`/learners/${learnerId}/preferences`, {
    headers: guardianHeaders(familyId, guardianId),
  });

export const setPreferences = (
  familyId: string,
  guardianId: string,
  learnerId: string,
  body: {
    focus?: { subject: string; strand: string } | null;
    focusSkillId?: string | null;
    caps?: { maxDailyMinutes?: number | null; maxContinuousMinutes?: number | null } | null;
  },
) =>
  call<{ preference: GuardianPreference }>(`/learners/${learnerId}/preferences`, {
    method: 'PUT',
    headers: guardianHeaders(familyId, guardianId),
    body,
  });

// ---- Guardian self-service: usage + data-subject requests -------------------

export interface UsageToday {
  day: string;
  usedTodayMinutes: number;
  maxDailyMinutes: number | null;
}

/** Today's learning time from the usage ledger (derived, read-only). */
export const getUsage = (familyId: string, guardianId: string, learnerId: string) =>
  call<UsageToday>(`/learners/${learnerId}/usage`, {
    headers: guardianHeaders(familyId, guardianId),
  });

export interface DataRequestReceipt {
  requestId: string;
  kind: 'access' | 'erasure';
  state: string;
  receivedAt?: string;
}

/** Submit a data-subject request (access/export or erasure) for the learner.
 *  This is intake only — a guardian never executes an erasure; the privacy team
 *  / operator fulfils it. */
export const submitDataRequest = (
  familyId: string,
  guardianId: string,
  learnerId: string,
  kind: 'access' | 'erasure',
  note?: string,
) =>
  call<DataRequestReceipt>(`/learners/${learnerId}/data-requests`, {
    method: 'POST',
    headers: guardianHeaders(familyId, guardianId),
    body: { kind, ...(note ? { note } : {}) },
  });

// ---- Diagnostic → placement -------------------------------------------------

export interface PlacementSkill {
  skillId: string;
  state: string;
  standing: string;
  confidence: number;
  unknownDimensions: string[];
}
export interface PlacementPlanItem {
  skillId: string;
  reasonCode: string;
  confidenceLimited: boolean;
}
export interface Placement {
  subject: string;
  course: string;
  profile: { learnerAlias: string; skills: PlacementSkill[]; policyVersion: string };
  plan: { runId: string; planVersion: string; items: PlacementPlanItem[]; hasUnknowns: boolean };
  entry: SessionNext;
}

export interface DiagnosticProbe {
  clientSubmissionId: string;
  taskId: string;
  answer: string;
  representation?: string;
}

export const runDiagnosticProbes = (
  familyId: string,
  learnerId: string,
  runId: string,
  probes: DiagnosticProbe[],
) =>
  call<{ runId: string; results: { skillId: string; correct: boolean; recorded: boolean }[] }>(
    `/learners/${learnerId}/diagnostic/probes`,
    { method: 'POST', headers: childHeaders(familyId, learnerId), body: { runId, probes } },
  );

export const getPlacement = (
  familyId: string,
  guardianId: string,
  learnerId: string,
  subject: 'math' | 'english',
  strand?: string,
) =>
  call<Placement>(
    `/learners/${learnerId}/placement?subject=${subject}${strand ? `&strand=${strand}` : ''}`,
    { headers: guardianHeaders(familyId, guardianId) },
  );

// Adaptive diagnostic run — the server picks each probe and decides when to stop.
export interface DiagnosticProbeTask {
  skillId: string;
  taskId: string;
  question: string;
  options: string[];
}
export type DiagnosticStop =
  | { kind: 'SUFFICIENT' }
  | { kind: 'PARTIAL'; reason: string; unresolvedSkillIds: string[] };
export interface DiagnosticRunStep {
  runId: string;
  state: string;
  probesUsed: number;
  policyVersion?: string;
  graded?: boolean;
  correct?: boolean;
  skillId?: string;
  next?: DiagnosticProbeTask;
  complete?: boolean;
  stop?: DiagnosticStop;
  placement?: Placement;
}

export const startDiagnosticRun = (
  familyId: string,
  learnerId: string,
  subject: 'math' | 'english',
  strand?: string,
) =>
  call<DiagnosticRunStep>(`/learners/${learnerId}/diagnostic/runs`, {
    method: 'POST',
    headers: childHeaders(familyId, learnerId),
    body: { subject, strand },
  });

export const answerDiagnosticProbe = (
  familyId: string,
  learnerId: string,
  runId: string,
  body: { clientSubmissionId: string; taskId: string; answer: string },
) =>
  call<DiagnosticRunStep>(`/learners/${learnerId}/diagnostic/runs/${runId}/answer`, {
    method: 'POST',
    headers: childHeaders(familyId, learnerId),
    body,
  });

/** Resume an interrupted run — returns the current probe or completion. */
export const resumeDiagnosticRun = (familyId: string, learnerId: string, runId: string) =>
  call<DiagnosticRunStep>(`/learners/${learnerId}/diagnostic/runs/${runId}`, {
    headers: childHeaders(familyId, learnerId),
  });

// ---- Operator / QA status ---------------------------------------------------

export function operatorHeaders(): Record<string, string> {
  return { 'x-actor-type': 'operator', 'x-actor-alias': 'web-operator' };
}

export interface OperatorStatus {
  environment: string;
  primaryRegion: string;
  drRegion: string;
  isProd: boolean;
  prodReady: boolean;
  policies: {
    mastery: { decisionId: string; version: string; approved: boolean };
    usageCaps: {
      decisionId: string;
      allApproved: boolean;
      bands: { band: string; status: string; approved: boolean; decisionId: string }[];
    };
    escalation: { decisionId: string; approved: boolean; configuredCells: number };
    retention: {
      decisionId: string;
      ready: boolean;
      unconfiguredCount: number;
      unapprovedCount: number;
    };
  };
  ai: {
    providerConfigured: boolean;
    inputProviderConfigured: boolean;
    candidateModel: {
      modelId: string;
      status: string;
      allowedRegions: string[];
      trainingDisabled: boolean;
    } | null;
    anyModelApprovedForProduction: boolean;
  };
  modelEval: {
    endpoint: string;
    runnable: boolean;
    envelope: { ageBands: string[]; subjects: string[]; capabilities: string[] } | null;
    latency: { sloMs: number | null; decisionId: string; approved: boolean; recordedRuns: number };
  };
  killSwitches: { capability: string; active: boolean }[];
  contentGate: { active: boolean; positive: boolean; negativeBlocked: boolean };
}

export const operatorStatus = () =>
  call<OperatorStatus>('/operator/status', { headers: operatorHeaders() });

/* ---- Privacy operations (operator-only): erasure + retention sweep ---- */

export interface ErasureVerification {
  complete: boolean;
  outstanding: string[];
}
export interface ErasureTargetOutcome {
  target: { id: string; kind: string; required: boolean };
  status: string;
  at?: string;
  note?: string;
}
export interface ErasureRecord {
  scope: { subjectType: string; subjectId: string; reason: string; requestedAt: string };
  outcomes: ErasureTargetOutcome[];
}
export interface ErasureResult {
  requestId: string;
  subjectType?: string;
  state: string;
  deleted?: unknown;
  record: ErasureRecord;
  verification: ErasureVerification;
}

/** Start an erasure. A 'family' subject cascades across every learner + family rows. */
export const startErasure = (
  subjectType: 'learner' | 'family',
  subjectId: string,
  reason: string,
) =>
  call<ErasureResult>('/privacy/erasure', {
    method: 'POST',
    headers: operatorHeaders(),
    body: { subjectType, subjectId, reason },
  });

/** Attest an external target's outcome (analytics / provider / backups). */
export const attestErasure = (requestId: string, targetId: string, status: string) =>
  call<ErasureResult>(`/privacy/erasure/${encodeURIComponent(requestId)}/attest`, {
    method: 'POST',
    headers: operatorHeaders(),
    body: { targetId, status },
  });

export const getErasure = (requestId: string) =>
  call<ErasureResult>(`/privacy/erasure/${encodeURIComponent(requestId)}`, {
    headers: operatorHeaders(),
  });

export interface RetentionSweepRow {
  dataClass: string;
  activeDays: number | null;
  deletion: string | null;
  basis: string | null;
  store: string | null;
  scanned: number;
  due: number;
  actioned: number;
  status: string;
}
export interface RetentionSweepResult {
  asOf: string;
  dryRun: boolean;
  requireApproved: boolean;
  summary: { classes: number; totalDue: number; totalActioned: number };
  report: RetentionSweepRow[];
}
/** Apply the retention schedule. dryRun flags due records without deleting. */
export const retentionSweep = (dryRun: boolean, asOf?: string) =>
  call<RetentionSweepResult>('/privacy/retention/sweep', {
    method: 'POST',
    headers: operatorHeaders(),
    body: { dryRun, ...(asOf ? { asOf } : {}) },
  });
