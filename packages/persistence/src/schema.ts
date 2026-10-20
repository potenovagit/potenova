import {
  pgTable,
  text,
  boolean,
  integer,
  doublePrecision,
  bigserial,
  timestamp,
} from 'drizzle-orm/pg-core';

/**
 * Potenova persistence schema (WP-03 + all durable stores; ADR-0002/0017).
 *
 * One PostgreSQL database, many tables. The same Drizzle schema runs on PGlite
 * (dev/test, in-process, on disk) and managed PostgreSQL in Canada (prod).
 *
 * Append-only tables (evidence, corrections, security audit, provider callbacks,
 * submissions) are written through insert/select only. Current-state tables
 * (entitlement, kill switch, asset, session, …) upsert by primary key. Nothing
 * authoritative lives only in memory.
 */

/* ---- evidence ledger (WP-03) ---- */
export const masteryEvidence = pgTable('mastery_evidence', {
  eventId: text('event_id').primaryKey(),
  learnerAlias: text('learner_alias').notNull(),
  skillId: text('skill_id').notNull(),
  mode: text('mode').notNull(),
  assistanceBand: text('assistance_band').notNull(),
  correct: boolean('correct').notNull(),
  representation: text('representation').notNull(),
  recognitionConfidence: doublePrecision('recognition_confidence').notNull(),
  observedAt: text('observed_at').notNull(),
  curriculumReleaseId: text('curriculum_release_id').notNull(),
  schemaVersion: text('schema_version').notNull(),
  ingestedAt: timestamp('ingested_at', { withTimezone: true }).notNull().defaultNow(),
});
export const evidenceCorrection = pgTable('evidence_correction', {
  correctionId: text('correction_id').primaryKey(),
  targetEventId: text('target_event_id').notNull(),
  reason: text('reason').notNull(),
  retract: boolean('retract').notNull(),
  createdAt: text('created_at').notNull(),
});

/* ---- identity & consent (WP-01) ---- */
export const family = pgTable('family', {
  familyId: text('family_id').primaryKey(),
  marketRegion: text('market_region').notNull(),
  legalOwnerGuardianId: text('legal_owner_guardian_id').notNull(),
  status: text('status').notNull(),
});
export const guardian = pgTable('guardian', {
  guardianId: text('guardian_id').primaryKey(),
  familyId: text('family_id').notNull(),
  role: text('role').notNull(),
  status: text('status').notNull(),
});
export const learnerProfile = pgTable('learner_profile', {
  learnerId: text('learner_id').primaryKey(),
  familyId: text('family_id').notNull(),
  nickname: text('nickname').notNull(),
  grade: integer('grade').notNull(),
  ageBand: text('age_band').notNull(),
  lifecycleStatus: text('lifecycle_status').notNull(),
});
/**
 * Guardian ↔ IdP-subject directory (ADR-0035). Maps a HASH of the managed IdP's
 * opaque guardian subject to Potenova's own family/guardian ids — the explicit,
 * persisted replacement for the deterministic scaffold mapping. The raw subject
 * is never stored (only its hash), and the ids it points at are independent of
 * the subject.
 */
export const idpDirectory = pgTable('idp_directory', {
  subjectHash: text('subject_hash').primaryKey(),
  guardianId: text('guardian_id').notNull(),
  familyId: text('family_id').notNull(),
  linkedAt: text('linked_at').notNull(),
});
// Operator ↔ IdP-subject directory (SEC-013/SEC-002). Operators are PRE-REGISTERED
// (no self-provisioning) and carry an RBAC role; the raw subject is never stored.
export const operatorDirectory = pgTable('operator_directory', {
  subjectHash: text('subject_hash').primaryKey(),
  operatorId: text('operator_id').notNull(),
  role: text('role').notNull(),
  status: text('status').notNull(),
  linkedAt: text('linked_at').notNull(),
});
// Dual-authorization requests (SEC-003). A highest-risk action requested by one
// operator and approved by a different one (maker-checker); separate from the
// audit log, which records each transition.
export const dualAuthRequest = pgTable('dual_auth_request', {
  requestId: text('request_id').primaryKey(),
  action: text('action').notNull(),
  params: text('params').notNull(),
  reason: text('reason').notNull(),
  requestedBy: text('requested_by').notNull(),
  requestedAt: text('requested_at').notNull(),
  status: text('status').notNull(),
  approvedBy: text('approved_by'),
  decidedAt: text('decided_at'),
  expiresAt: text('expires_at').notNull(),
});
// Notification outbox. A durable queue of notifications a real worker drains
// (guardian-facing messages; signals the billing service consumes). Enqueue-only
// from the app — delivery is out of scope pre-G2 (no email/SMS provider wired).
export const notification = pgTable('notification', {
  notificationId: text('notification_id').primaryKey(),
  recipient: text('recipient').notNull(),
  familyId: text('family_id'),
  kind: text('kind').notNull(),
  payload: text('payload').notNull(),
  status: text('status').notNull(),
  createdAt: text('created_at').notNull(),
});
export const consentGrant = pgTable('consent_grant', {
  grantId: text('grant_id').primaryKey(),
  familyId: text('family_id').notNull(),
  purpose: text('purpose').notNull(),
  version: text('version').notNull(),
  modality: text('modality').notNull(),
  state: text('state').notNull(),
  grantedAt: text('granted_at').notNull(),
  revokedAt: text('revoked_at'),
});

/* ---- billing & entitlement (WP-12) ---- */
export const entitlement = pgTable('entitlement', {
  familyId: text('family_id').primaryKey(),
  state: text('state').notNull(),
  tierId: text('tier_id'),
  updatedAt: text('updated_at').notNull(),
});
export const providerCallback = pgTable('provider_callback', {
  callbackKey: text('callback_key').primaryKey(), // channel:transactionId
  channel: text('channel').notNull(),
  transactionId: text('transaction_id').notNull(),
  familyId: text('family_id').notNull(),
  kind: text('kind').notNull(),
  appliedAt: text('applied_at').notNull(),
});

/* ---- content (WP-05) ---- */
export const contentAsset = pgTable('content_asset', {
  assetId: text('asset_id').primaryKey(),
  assetVersion: text('asset_version').notNull(),
  state: text('state').notNull(),
  provenance: text('provenance').notNull(),
  subject: text('subject').notNull(),
  ageBand: text('age_band').notNull(),
  producedBy: text('produced_by').notNull(),
  curriculumReleaseId: text('curriculum_release_id').notNull(),
});
export const assetQuarantine = pgTable('asset_quarantine', {
  assetId: text('asset_id').primaryKey(),
  assetVersion: text('asset_version').notNull(),
  reasonCode: text('reason_code').notNull(),
  actor: text('actor').notNull(),
  at: text('at').notNull(),
  regressionCaseId: text('regression_case_id').notNull(),
});

/* ---- safety & privacy (WP-11) ---- */
export const securityAudit = pgTable('security_audit', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  approver: text('approver').notNull(),
  reason: text('reason').notNull(),
  object: text('object').notNull(),
  action: text('action').notNull(),
  outcome: text('outcome').notNull(),
  expiry: text('expiry'),
  at: text('at').notNull(),
});
export const dataSubjectRequest = pgTable('data_subject_request', {
  requestId: text('request_id').primaryKey(),
  kind: text('kind').notNull(),
  /** 'learner' | 'family' — who the erasure is for. */
  subjectType: text('subject_type'),
  subjectId: text('subject_id'),
  reason: text('reason'),
  state: text('state').notNull(),
  /** The serialized ErasureRecord (per-target outcomes), for accountability. */
  outcomesJson: text('outcomes_json'),
  updatedAt: text('updated_at').notNull(),
});

/* ---- operator (WP-13) ---- */
export const killSwitch = pgTable('kill_switch', {
  capability: text('capability').primaryKey(),
  disabled: boolean('disabled').notNull(),
  actor: text('actor').notNull(),
  reason: text('reason').notNull(),
  at: text('at').notNull(),
});
/** Model-eval run evidence (AI-003 / ER-05 / NFR-07). Append-only; latency and
 *  containment are reported, never pass/failed here — the SLO is an owner decision. */
export const evalRun = pgTable('eval_run', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  modelId: text('model_id').notNull(),
  kind: text('kind').notNull(), // 'single' | 'suite'
  latencyMs: integer('latency_ms').notNull(),
  accuracy: doublePrecision('accuracy'),
  containmentHeld: boolean('containment_held').notNull(),
  verdict: text('verdict').notNull(),
  at: text('at').notNull(),
});
export const incident = pgTable('incident', {
  incidentId: text('incident_id').primaryKey(),
  stream: text('stream').notNull(),
  severity: text('severity').notNull(),
  owner: text('owner').notNull(),
  state: text('state').notNull(),
  rcaAttached: boolean('rca_attached').notNull(),
  regressionCaseId: text('regression_case_id'),
});

/* ---- sessions (WP-06/07/08) ---- */
export const diagnosticRun = pgTable('diagnostic_run', {
  runId: text('run_id').primaryKey(),
  runVersion: integer('run_version').notNull(),
  learnerAlias: text('learner_alias').notNull(),
  subject: text('subject').notNull(),
  /** The strand/course the run probes (e.g. 'addition'); null = subject default. */
  strand: text('strand'),
  curriculumReleaseId: text('curriculum_release_id').notNull(),
  state: text('state').notNull(),
  probesUsed: integer('probes_used').notNull(),
});
export const tutoringSession = pgTable('tutoring_session', {
  sessionId: text('session_id').primaryKey(),
  learnerAlias: text('learner_alias').notNull(),
  subject: text('subject').notNull(),
  state: text('state').notNull(),
  /** The strand/course within the subject (e.g. 'fractions'); null = subject default. */
  strand: text('strand'),
  /** When the session went ACTIVE (for early-end usage reconciliation). */
  startedAt: text('started_at'),
  /** Minutes reserved against the daily cap at start (refunded on early end). */
  reservedMinutes: integer('reserved_minutes'),
});
export const submission = pgTable('submission', {
  clientSubmissionId: text('client_submission_id').primaryKey(),
  at: text('at').notNull(),
});
export const usageLedger = pgTable('usage_ledger', {
  id: text('id').primaryKey(), // `${learnerAlias}:${day}`
  learnerAlias: text('learner_alias').notNull(),
  day: text('day').notNull(),
  minutesUsed: integer('minutes_used').notNull(),
});
/** Guardian controls per learner (PAR): a subject→strand focus and tightened
 *  usage caps. Parent limits may only tighten the safety cap, never loosen it. */
export const guardianPreference = pgTable('guardian_preference', {
  learnerAlias: text('learner_alias').primaryKey(),
  focusSubject: text('focus_subject'),
  focusStrand: text('focus_strand'),
  focusSkillId: text('focus_skill_id'),
  maxDailyMinutes: integer('max_daily_minutes'),
  maxContinuousMinutes: integer('max_continuous_minutes'),
});

/* ---- curriculum reference (WP-02) ---- */
export const skill = pgTable('skill', {
  skillId: text('skill_id').primaryKey(),
  domain: text('domain').notNull(),
  competency: text('competency').notNull(),
  skill: text('skill').notNull(),
  subskill: text('subskill'),
  version: text('version').notNull(),
  status: text('status').notNull(),
});
export const skillDependency = pgTable('skill_dependency', {
  dependencyId: text('dependency_id').primaryKey(),
  fromSkillId: text('from_skill_id').notNull(),
  toSkillId: text('to_skill_id').notNull(),
  type: text('type').notNull(),
  weight: doublePrecision('weight').notNull(),
  approvalStatus: text('approval_status').notNull(),
  approvalVersion: text('approval_version'),
});

/** Full DDL applied at database init (dev/test). Production uses migrations. */
export const ALL_DDL = `
CREATE TABLE IF NOT EXISTS mastery_evidence (
  event_id text PRIMARY KEY, learner_alias text NOT NULL, skill_id text NOT NULL,
  mode text NOT NULL, assistance_band text NOT NULL, correct boolean NOT NULL,
  representation text NOT NULL, recognition_confidence double precision NOT NULL,
  observed_at text NOT NULL, curriculum_release_id text NOT NULL, schema_version text NOT NULL,
  ingested_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS idx_evidence_learner_skill ON mastery_evidence (learner_alias, skill_id);
CREATE TABLE IF NOT EXISTS evidence_correction (
  correction_id text PRIMARY KEY, target_event_id text NOT NULL, reason text NOT NULL,
  retract boolean NOT NULL, created_at text NOT NULL);
CREATE INDEX IF NOT EXISTS idx_correction_target ON evidence_correction (target_event_id);

CREATE TABLE IF NOT EXISTS family (
  family_id text PRIMARY KEY, market_region text NOT NULL, legal_owner_guardian_id text NOT NULL, status text NOT NULL);
CREATE TABLE IF NOT EXISTS guardian (
  guardian_id text PRIMARY KEY, family_id text NOT NULL, role text NOT NULL, status text NOT NULL);
CREATE TABLE IF NOT EXISTS learner_profile (
  learner_id text PRIMARY KEY, family_id text NOT NULL, nickname text NOT NULL, grade integer NOT NULL,
  age_band text NOT NULL, lifecycle_status text NOT NULL);
CREATE TABLE IF NOT EXISTS idp_directory (
  subject_hash text PRIMARY KEY, guardian_id text NOT NULL, family_id text NOT NULL, linked_at text NOT NULL);
CREATE TABLE IF NOT EXISTS operator_directory (
  subject_hash text PRIMARY KEY, operator_id text NOT NULL, role text NOT NULL, status text NOT NULL,
  linked_at text NOT NULL);
CREATE TABLE IF NOT EXISTS dual_auth_request (
  request_id text PRIMARY KEY, action text NOT NULL, params text NOT NULL, reason text NOT NULL,
  requested_by text NOT NULL, requested_at text NOT NULL, status text NOT NULL,
  approved_by text, decided_at text, expires_at text NOT NULL);
CREATE TABLE IF NOT EXISTS notification (
  notification_id text PRIMARY KEY, recipient text NOT NULL, family_id text, kind text NOT NULL,
  payload text NOT NULL, status text NOT NULL, created_at text NOT NULL);
CREATE TABLE IF NOT EXISTS consent_grant (
  grant_id text PRIMARY KEY, family_id text NOT NULL, purpose text NOT NULL, version text NOT NULL,
  modality text NOT NULL, state text NOT NULL, granted_at text NOT NULL, revoked_at text);
CREATE INDEX IF NOT EXISTS idx_consent_family ON consent_grant (family_id);

CREATE TABLE IF NOT EXISTS entitlement (
  family_id text PRIMARY KEY, state text NOT NULL, tier_id text, updated_at text NOT NULL);
CREATE TABLE IF NOT EXISTS provider_callback (
  callback_key text PRIMARY KEY, channel text NOT NULL, transaction_id text NOT NULL,
  family_id text NOT NULL, kind text NOT NULL, applied_at text NOT NULL);

CREATE TABLE IF NOT EXISTS content_asset (
  asset_id text PRIMARY KEY, asset_version text NOT NULL, state text NOT NULL, provenance text NOT NULL,
  subject text NOT NULL, age_band text NOT NULL, produced_by text NOT NULL, curriculum_release_id text NOT NULL);
CREATE TABLE IF NOT EXISTS asset_quarantine (
  asset_id text PRIMARY KEY, asset_version text NOT NULL, reason_code text NOT NULL, actor text NOT NULL,
  at text NOT NULL, regression_case_id text NOT NULL);

CREATE TABLE IF NOT EXISTS security_audit (
  id bigserial PRIMARY KEY, approver text NOT NULL, reason text NOT NULL, object text NOT NULL,
  action text NOT NULL, outcome text NOT NULL, expiry text, at text NOT NULL);
CREATE TABLE IF NOT EXISTS data_subject_request (
  request_id text PRIMARY KEY, kind text NOT NULL, subject_type text, subject_id text, reason text,
  state text NOT NULL, outcomes_json text, updated_at text NOT NULL);

CREATE TABLE IF NOT EXISTS kill_switch (
  capability text PRIMARY KEY, disabled boolean NOT NULL, actor text NOT NULL, reason text NOT NULL, at text NOT NULL);
CREATE TABLE IF NOT EXISTS eval_run (
  id bigserial PRIMARY KEY, model_id text NOT NULL, kind text NOT NULL, latency_ms integer NOT NULL,
  accuracy double precision, containment_held boolean NOT NULL, verdict text NOT NULL, at text NOT NULL);
CREATE TABLE IF NOT EXISTS incident (
  incident_id text PRIMARY KEY, stream text NOT NULL, severity text NOT NULL, owner text NOT NULL,
  state text NOT NULL, rca_attached boolean NOT NULL, regression_case_id text);

CREATE TABLE IF NOT EXISTS diagnostic_run (
  run_id text PRIMARY KEY, run_version integer NOT NULL, learner_alias text NOT NULL, subject text NOT NULL,
  strand text, curriculum_release_id text NOT NULL, state text NOT NULL, probes_used integer NOT NULL);
CREATE TABLE IF NOT EXISTS tutoring_session (
  session_id text PRIMARY KEY, learner_alias text NOT NULL, subject text NOT NULL, state text NOT NULL,
  strand text, started_at text, reserved_minutes integer);
CREATE TABLE IF NOT EXISTS submission (
  client_submission_id text PRIMARY KEY, at text NOT NULL);
CREATE TABLE IF NOT EXISTS usage_ledger (
  id text PRIMARY KEY, learner_alias text NOT NULL, day text NOT NULL, minutes_used integer NOT NULL);
CREATE TABLE IF NOT EXISTS guardian_preference (
  learner_alias text PRIMARY KEY, focus_subject text, focus_strand text, focus_skill_id text,
  max_daily_minutes integer, max_continuous_minutes integer);

CREATE TABLE IF NOT EXISTS skill (
  skill_id text PRIMARY KEY, domain text NOT NULL, competency text NOT NULL, skill text NOT NULL,
  subskill text, version text NOT NULL, status text NOT NULL);
CREATE TABLE IF NOT EXISTS skill_dependency (
  dependency_id text PRIMARY KEY, from_skill_id text NOT NULL, to_skill_id text NOT NULL, type text NOT NULL,
  weight double precision NOT NULL, approval_status text NOT NULL, approval_version text);
`;
