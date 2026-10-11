// services/api/src/server.ts
import { serve } from '@hono/node-server';

// packages/contracts/dist/errors.js
var DomainError = class extends Error {
  code;
  constructor(code, message) {
    super(message ?? code);
    this.name = 'DomainError';
    this.code = code;
  }
};
function isDomainError(e) {
  return e instanceof DomainError;
}

// packages/contracts/dist/actors.js
var ACTOR_TYPES = [
  'guardian',
  // authenticated parent/guardian (parent-only surfaces)
  'child',
  // least-privileged learner session
  'tutor_engine',
  // adaptive tutoring/session planner — submits evidence only
  'billing_service',
  // entitlement lifecycle — never touches learning history
  'learner_state_projector',
  // SOLE authority that advances LearnerSkillState
  'evidence_producer',
  // signed, trusted producer that appends EvidenceEvents
  'content_validator',
  // independent pre-delivery validation
  'ai_gateway',
  // model routing / provider abstraction
  'child_safety',
  // independent safety layer
  'operator',
  // privileged admin (JIT, audited)
  'system',
  // internal schedulers/reconcilers
];

// packages/contracts/dist/regions.js
var APPROVED_REGIONS = [
  'ca-central',
  // primary (e.g. Toronto / Montreal)
  'ca-east',
  // disaster recovery (second Canadian region)
];
function isApprovedRegion(region) {
  return APPROVED_REGIONS.includes(region);
}

// packages/config/dist/index.js
var ENVIRONMENTS = ['dev', 'test', 'staging', 'prod'];
function parseEnvironment(v) {
  if (v && ENVIRONMENTS.includes(v)) return v;
  throw new DomainError('POLICY_BLOCKED', `invalid NODE_ENV/APP_ENV: ${String(v)}`);
}
function parseRegion(name, v) {
  if (v && isApprovedRegion(v)) return v;
  throw new DomainError('REGION_DISALLOWED', `${name} must be a Canada-resident region`);
}
function loadConfig(env = process.env) {
  const environment = parseEnvironment(env.APP_ENV ?? env.NODE_ENV);
  const primaryRegion = parseRegion('PRIMARY_REGION', env.PRIMARY_REGION ?? 'ca-central');
  const drRegion = parseRegion('DR_REGION', env.DR_REGION ?? 'ca-east');
  const allowRealChildData = environment === 'prod';
  if (primaryRegion === drRegion) {
    throw new DomainError('POLICY_BLOCKED', 'DR region must differ from primary region');
  }
  return { environment, primaryRegion, drRegion, allowRealChildData };
}

// services/api/src/app.ts
import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';

// services/api/src/modules.ts
var DOMAIN_MODULES = [
  { key: 'identity', name: 'Identity & Family', dataClass: 'Confidential', criticality: 'highest' },
  {
    key: 'privacy',
    name: 'Privacy & Data Governance',
    dataClass: 'Highly Sensitive Child Data',
    criticality: 'highest',
  },
  { key: 'curriculum', name: 'Curriculum & Knowledge', dataClass: 'Internal', criticality: 'high' },
  {
    key: 'evidence',
    name: 'Learning Evidence',
    dataClass: 'Highly Sensitive Child Data',
    criticality: 'highest',
  },
  {
    key: 'learner-state',
    name: 'Learner State',
    dataClass: 'Highly Sensitive Child Data',
    criticality: 'highest',
  },
  {
    key: 'diagnostic',
    name: 'Assessment / Diagnostic',
    dataClass: 'Highly Sensitive Child Data',
    criticality: 'high',
  },
  {
    key: 'tutoring',
    name: 'Tutoring & Session Planning',
    dataClass: 'Highly Sensitive Child Data',
    criticality: 'high',
  },
  { key: 'content', name: 'Content', dataClass: 'Confidential', criticality: 'high' },
  {
    key: 'ai-gateway',
    name: 'AI Orchestration',
    dataClass: 'Confidential',
    criticality: 'highest',
  },
  {
    key: 'safety',
    name: 'Child Safety',
    dataClass: 'Highly Sensitive Child Data',
    criticality: 'highest',
  },
  {
    key: 'parent',
    name: 'Parent Experience',
    dataClass: 'Highly Sensitive Child Data',
    criticality: 'high',
  },
  {
    key: 'billing',
    name: 'Billing & Entitlements',
    dataClass: 'Confidential',
    criticality: 'high',
  },
  {
    key: 'analytics',
    name: 'Analytics & Admin',
    dataClass: 'Confidential',
    criticality: 'standard',
  },
  {
    key: 'support',
    name: 'Support & Operations',
    dataClass: 'Confidential',
    criticality: 'standard',
  },
];

// packages/persistence/dist/schema.js
import {
  pgTable,
  text,
  boolean,
  integer,
  doublePrecision,
  bigserial,
  timestamp,
} from 'drizzle-orm/pg-core';
var masteryEvidence = pgTable('mastery_evidence', {
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
var evidenceCorrection = pgTable('evidence_correction', {
  correctionId: text('correction_id').primaryKey(),
  targetEventId: text('target_event_id').notNull(),
  reason: text('reason').notNull(),
  retract: boolean('retract').notNull(),
  createdAt: text('created_at').notNull(),
});
var family = pgTable('family', {
  familyId: text('family_id').primaryKey(),
  marketRegion: text('market_region').notNull(),
  legalOwnerGuardianId: text('legal_owner_guardian_id').notNull(),
  status: text('status').notNull(),
});
var guardian = pgTable('guardian', {
  guardianId: text('guardian_id').primaryKey(),
  familyId: text('family_id').notNull(),
  role: text('role').notNull(),
  status: text('status').notNull(),
});
var learnerProfile = pgTable('learner_profile', {
  learnerId: text('learner_id').primaryKey(),
  familyId: text('family_id').notNull(),
  nickname: text('nickname').notNull(),
  grade: integer('grade').notNull(),
  ageBand: text('age_band').notNull(),
  lifecycleStatus: text('lifecycle_status').notNull(),
});
var consentGrant = pgTable('consent_grant', {
  grantId: text('grant_id').primaryKey(),
  familyId: text('family_id').notNull(),
  purpose: text('purpose').notNull(),
  version: text('version').notNull(),
  modality: text('modality').notNull(),
  state: text('state').notNull(),
  grantedAt: text('granted_at').notNull(),
  revokedAt: text('revoked_at'),
});
var entitlement = pgTable('entitlement', {
  familyId: text('family_id').primaryKey(),
  state: text('state').notNull(),
  tierId: text('tier_id'),
  updatedAt: text('updated_at').notNull(),
});
var providerCallback = pgTable('provider_callback', {
  callbackKey: text('callback_key').primaryKey(),
  // channel:transactionId
  channel: text('channel').notNull(),
  transactionId: text('transaction_id').notNull(),
  familyId: text('family_id').notNull(),
  kind: text('kind').notNull(),
  appliedAt: text('applied_at').notNull(),
});
var contentAsset = pgTable('content_asset', {
  assetId: text('asset_id').primaryKey(),
  assetVersion: text('asset_version').notNull(),
  state: text('state').notNull(),
  provenance: text('provenance').notNull(),
  subject: text('subject').notNull(),
  ageBand: text('age_band').notNull(),
  producedBy: text('produced_by').notNull(),
  curriculumReleaseId: text('curriculum_release_id').notNull(),
});
var assetQuarantine = pgTable('asset_quarantine', {
  assetId: text('asset_id').primaryKey(),
  assetVersion: text('asset_version').notNull(),
  reasonCode: text('reason_code').notNull(),
  actor: text('actor').notNull(),
  at: text('at').notNull(),
  regressionCaseId: text('regression_case_id').notNull(),
});
var securityAudit = pgTable('security_audit', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  approver: text('approver').notNull(),
  reason: text('reason').notNull(),
  object: text('object').notNull(),
  action: text('action').notNull(),
  outcome: text('outcome').notNull(),
  expiry: text('expiry'),
  at: text('at').notNull(),
});
var dataSubjectRequest = pgTable('data_subject_request', {
  requestId: text('request_id').primaryKey(),
  kind: text('kind').notNull(),
  state: text('state').notNull(),
  updatedAt: text('updated_at').notNull(),
});
var killSwitch = pgTable('kill_switch', {
  capability: text('capability').primaryKey(),
  disabled: boolean('disabled').notNull(),
  actor: text('actor').notNull(),
  reason: text('reason').notNull(),
  at: text('at').notNull(),
});
var incident = pgTable('incident', {
  incidentId: text('incident_id').primaryKey(),
  stream: text('stream').notNull(),
  severity: text('severity').notNull(),
  owner: text('owner').notNull(),
  state: text('state').notNull(),
  rcaAttached: boolean('rca_attached').notNull(),
  regressionCaseId: text('regression_case_id'),
});
var diagnosticRun = pgTable('diagnostic_run', {
  runId: text('run_id').primaryKey(),
  runVersion: integer('run_version').notNull(),
  learnerAlias: text('learner_alias').notNull(),
  subject: text('subject').notNull(),
  curriculumReleaseId: text('curriculum_release_id').notNull(),
  state: text('state').notNull(),
  probesUsed: integer('probes_used').notNull(),
});
var tutoringSession = pgTable('tutoring_session', {
  sessionId: text('session_id').primaryKey(),
  learnerAlias: text('learner_alias').notNull(),
  subject: text('subject').notNull(),
  state: text('state').notNull(),
});
var submission = pgTable('submission', {
  clientSubmissionId: text('client_submission_id').primaryKey(),
  at: text('at').notNull(),
});
var skill = pgTable('skill', {
  skillId: text('skill_id').primaryKey(),
  domain: text('domain').notNull(),
  competency: text('competency').notNull(),
  skill: text('skill').notNull(),
  subskill: text('subskill'),
  version: text('version').notNull(),
  status: text('status').notNull(),
});
var skillDependency = pgTable('skill_dependency', {
  dependencyId: text('dependency_id').primaryKey(),
  fromSkillId: text('from_skill_id').notNull(),
  toSkillId: text('to_skill_id').notNull(),
  type: text('type').notNull(),
  weight: doublePrecision('weight').notNull(),
  approvalStatus: text('approval_status').notNull(),
  approvalVersion: text('approval_version'),
});
var ALL_DDL = `
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
  request_id text PRIMARY KEY, kind text NOT NULL, state text NOT NULL, updated_at text NOT NULL);

CREATE TABLE IF NOT EXISTS kill_switch (
  capability text PRIMARY KEY, disabled boolean NOT NULL, actor text NOT NULL, reason text NOT NULL, at text NOT NULL);
CREATE TABLE IF NOT EXISTS incident (
  incident_id text PRIMARY KEY, stream text NOT NULL, severity text NOT NULL, owner text NOT NULL,
  state text NOT NULL, rca_attached boolean NOT NULL, regression_case_id text);

CREATE TABLE IF NOT EXISTS diagnostic_run (
  run_id text PRIMARY KEY, run_version integer NOT NULL, learner_alias text NOT NULL, subject text NOT NULL,
  curriculum_release_id text NOT NULL, state text NOT NULL, probes_used integer NOT NULL);
CREATE TABLE IF NOT EXISTS tutoring_session (
  session_id text PRIMARY KEY, learner_alias text NOT NULL, subject text NOT NULL, state text NOT NULL);
CREATE TABLE IF NOT EXISTS submission (
  client_submission_id text PRIMARY KEY, at text NOT NULL);

CREATE TABLE IF NOT EXISTS skill (
  skill_id text PRIMARY KEY, domain text NOT NULL, competency text NOT NULL, skill text NOT NULL,
  subskill text, version text NOT NULL, status text NOT NULL);
CREATE TABLE IF NOT EXISTS skill_dependency (
  dependency_id text PRIMARY KEY, from_skill_id text NOT NULL, to_skill_id text NOT NULL, type text NOT NULL,
  weight double precision NOT NULL, approval_status text NOT NULL, approval_version text);
`;

// packages/persistence/dist/database.js
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { drizzle as drizzleNodePg } from 'drizzle-orm/node-postgres';
import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';
var { Pool } = pg;
var PotenovaDb = class {
  #backend;
  #pg;
  #pool;
  #db;
  #ready = null;
  constructor(options) {
    const opts =
      typeof options === 'string'
        ? { kind: 'pglite', dataDir: options }
        : (options ?? { kind: 'pglite' });
    if (opts.kind === 'postgres') {
      this.#backend = 'postgres';
      this.#pool = new Pool({
        connectionString: opts.connectionString,
        ssl: opts.ssl ? { rejectUnauthorized: true } : false,
      });
      this.#db = drizzleNodePg(this.#pool);
    } else {
      this.#backend = 'pglite';
      this.#pg = opts.dataDir ? new PGlite(opts.dataDir) : new PGlite();
      this.#db = drizzlePglite(this.#pg);
    }
  }
  /** Which backend is in use — for logging and health reporting, never for logic. */
  get backend() {
    return this.#backend;
  }
  /** Ensure the schema exists (runs once) and return the query interface. */
  ready() {
    return (this.#ready ??= this.#applySchema());
  }
  #applySchema() {
    const applied =
      this.#backend === 'postgres'
        ? this.#pool.query(ALL_DDL).then(() => void 0)
        : this.#pg.exec(ALL_DDL).then(() => void 0);
    return applied.then(() => this.#db);
  }
  async close() {
    if (this.#backend === 'postgres') await this.#pool.end();
    else await this.#pg.close();
  }
};
function openDatabaseFromEnv(env = process.env) {
  if (env.DATABASE_URL) {
    return new PotenovaDb({
      kind: 'postgres',
      connectionString: env.DATABASE_URL,
      ssl: env.DATABASE_SSL !== 'false',
    });
  }
  return new PotenovaDb({ kind: 'pglite', dataDir: env.POTENOVA_DB_DIR || void 0 });
}

// packages/persistence/dist/evidence-repository.js
import { and, eq, inArray } from 'drizzle-orm';
var EvidenceRepository = class {
  h;
  constructor(h) {
    this.h = h;
  }
  async appendEvidence(e) {
    const db = await this.h.ready();
    await db
      .insert(masteryEvidence)
      .values({
        eventId: e.eventId,
        learnerAlias: e.learnerAlias,
        skillId: e.skillId,
        mode: e.mode,
        assistanceBand: e.assistanceBand,
        correct: e.correct,
        representation: e.representation,
        recognitionConfidence: e.recognitionConfidence,
        observedAt: e.observedAt,
        curriculumReleaseId: e.curriculumReleaseId,
        schemaVersion: e.schemaVersion,
      })
      .onConflictDoNothing();
  }
  async appendCorrection(c) {
    const db = await this.h.ready();
    await db
      .insert(evidenceCorrection)
      .values({
        correctionId: c.correctionId,
        targetEventId: c.targetEventId,
        reason: c.reason,
        retract: c.retract,
        createdAt: c.createdAt,
      })
      .onConflictDoNothing();
  }
  async listEvidence(learnerAlias, skillId) {
    const db = await this.h.ready();
    const rows = await db
      .select()
      .from(masteryEvidence)
      .where(
        and(eq(masteryEvidence.learnerAlias, learnerAlias), eq(masteryEvidence.skillId, skillId)),
      );
    return rows.map((r) => ({
      eventId: r.eventId,
      learnerAlias: r.learnerAlias,
      skillId: r.skillId,
      mode: r.mode,
      assistanceBand: r.assistanceBand,
      correct: r.correct,
      representation: r.representation,
      recognitionConfidence: r.recognitionConfidence,
      observedAt: r.observedAt,
      curriculumReleaseId: r.curriculumReleaseId,
      schemaVersion: r.schemaVersion,
    }));
  }
  async listCorrections(targetEventIds) {
    if (targetEventIds.length === 0) return [];
    const db = await this.h.ready();
    const rows = await db
      .select()
      .from(evidenceCorrection)
      .where(inArray(evidenceCorrection.targetEventId, [...targetEventIds]));
    return rows.map((r) => ({
      correctionId: r.correctionId,
      targetEventId: r.targetEventId,
      reason: r.reason,
      retract: r.retract,
      createdAt: r.createdAt,
    }));
  }
  async countEvidence() {
    const db = await this.h.ready();
    return (await db.select().from(masteryEvidence)).length;
  }
};

// packages/persistence/dist/identity-repository.js
import { eq as eq2 } from 'drizzle-orm';
var IdentityRepository = class {
  h;
  constructor(h) {
    this.h = h;
  }
  async saveFamily(f) {
    const db = await this.h.ready();
    await db
      .insert(family)
      .values(f)
      .onConflictDoUpdate({
        target: family.familyId,
        set: {
          marketRegion: f.marketRegion,
          legalOwnerGuardianId: f.legalOwnerGuardianId,
          status: f.status,
        },
      });
  }
  async getFamily(familyId) {
    const db = await this.h.ready();
    const [r] = await db.select().from(family).where(eq2(family.familyId, familyId));
    return r ?? null;
  }
  async saveGuardian(g) {
    const db = await this.h.ready();
    await db
      .insert(guardian)
      .values(g)
      .onConflictDoUpdate({
        target: guardian.guardianId,
        set: { familyId: g.familyId, role: g.role, status: g.status },
      });
  }
  async saveLearner(l) {
    const db = await this.h.ready();
    await db
      .insert(learnerProfile)
      .values(l)
      .onConflictDoUpdate({
        target: learnerProfile.learnerId,
        set: {
          familyId: l.familyId,
          nickname: l.nickname,
          grade: l.grade,
          ageBand: l.ageBand,
          lifecycleStatus: l.lifecycleStatus,
        },
      });
  }
  async getLearner(learnerId) {
    const db = await this.h.ready();
    const [r] = await db
      .select()
      .from(learnerProfile)
      .where(eq2(learnerProfile.learnerId, learnerId));
    return r ?? null;
  }
  async saveConsentGrant(c) {
    const db = await this.h.ready();
    await db
      .insert(consentGrant)
      .values(c)
      .onConflictDoUpdate({
        target: consentGrant.grantId,
        set: { state: c.state, revokedAt: c.revokedAt, version: c.version, modality: c.modality },
      });
  }
  async listConsentGrants(familyId) {
    const db = await this.h.ready();
    const rows = await db.select().from(consentGrant).where(eq2(consentGrant.familyId, familyId));
    return rows.map((r) => ({ ...r }));
  }
};

// packages/persistence/dist/billing-repository.js
import { eq as eq3 } from 'drizzle-orm';
var BillingRepository = class {
  h;
  constructor(h) {
    this.h = h;
  }
  async saveEntitlement(e) {
    const db = await this.h.ready();
    await db
      .insert(entitlement)
      .values(e)
      .onConflictDoUpdate({
        target: entitlement.familyId,
        set: { state: e.state, tierId: e.tierId, updatedAt: e.updatedAt },
      });
  }
  async getEntitlement(familyId) {
    const db = await this.h.ready();
    const [r] = await db.select().from(entitlement).where(eq3(entitlement.familyId, familyId));
    return r ?? null;
  }
  /** Durable idempotency: returns whether this callback was newly applied. */
  async recordCallback(input) {
    const db = await this.h.ready();
    const callbackKey = `${input.channel}:${input.transactionId}`;
    const res = await db
      .insert(providerCallback)
      .values({
        callbackKey,
        channel: input.channel,
        transactionId: input.transactionId,
        familyId: input.familyId,
        kind: input.kind,
        appliedAt: input.at,
      })
      .onConflictDoNothing()
      .returning({ callbackKey: providerCallback.callbackKey });
    const applied = res.length > 0;
    return { applied, duplicate: !applied };
  }
};

// packages/persistence/dist/content-repository.js
import { eq as eq4 } from 'drizzle-orm';
var ContentRepository = class {
  h;
  constructor(h) {
    this.h = h;
  }
  async saveAsset(a) {
    const db = await this.h.ready();
    await db
      .insert(contentAsset)
      .values(a)
      .onConflictDoUpdate({
        target: contentAsset.assetId,
        set: {
          assetVersion: a.assetVersion,
          state: a.state,
          provenance: a.provenance,
          subject: a.subject,
          ageBand: a.ageBand,
          producedBy: a.producedBy,
          curriculumReleaseId: a.curriculumReleaseId,
        },
      });
  }
  async getAsset(assetId) {
    const db = await this.h.ready();
    const [r] = await db.select().from(contentAsset).where(eq4(contentAsset.assetId, assetId));
    return r ?? null;
  }
  async quarantine(q) {
    const db = await this.h.ready();
    await db.insert(assetQuarantine).values(q).onConflictDoNothing();
  }
  async isQuarantined(assetId) {
    const db = await this.h.ready();
    const [r] = await db
      .select()
      .from(assetQuarantine)
      .where(eq4(assetQuarantine.assetId, assetId));
    return r !== void 0;
  }
};

// packages/persistence/dist/safety-repository.js
import { desc, eq as eq5 } from 'drizzle-orm';
var SafetyRepository = class {
  h;
  constructor(h) {
    this.h = h;
  }
  /** Append an audit event (insert only — never updated or deleted). */
  async recordAudit(e) {
    const db = await this.h.ready();
    await db.insert(securityAudit).values(e);
  }
  async recentAudit(limit = 100) {
    const db = await this.h.ready();
    const rows = await db.select().from(securityAudit).orderBy(desc(securityAudit.id)).limit(limit);
    return rows.map((r) => ({
      approver: r.approver,
      reason: r.reason,
      object: r.object,
      action: r.action,
      outcome: r.outcome,
      expiry: r.expiry,
      at: r.at,
    }));
  }
  async saveDsr(d) {
    const db = await this.h.ready();
    await db
      .insert(dataSubjectRequest)
      .values(d)
      .onConflictDoUpdate({
        target: dataSubjectRequest.requestId,
        set: { state: d.state, updatedAt: d.updatedAt },
      });
  }
  async getDsr(requestId) {
    const db = await this.h.ready();
    const [r] = await db
      .select()
      .from(dataSubjectRequest)
      .where(eq5(dataSubjectRequest.requestId, requestId));
    return r ?? null;
  }
};

// packages/persistence/dist/operator-repository.js
import { eq as eq6 } from 'drizzle-orm';
var OperatorRepository = class {
  h;
  constructor(h) {
    this.h = h;
  }
  async setKillSwitch(input) {
    const db = await this.h.ready();
    await db
      .insert(killSwitch)
      .values(input)
      .onConflictDoUpdate({
        target: killSwitch.capability,
        set: { disabled: input.disabled, actor: input.actor, reason: input.reason, at: input.at },
      });
  }
  /** Active unless an explicit disabled row says otherwise (fails safe). */
  async isCapabilityActive(capability) {
    const db = await this.h.ready();
    const [r] = await db.select().from(killSwitch).where(eq6(killSwitch.capability, capability));
    return r ? !r.disabled : true;
  }
  async saveIncident(i) {
    const db = await this.h.ready();
    await db
      .insert(incident)
      .values(i)
      .onConflictDoUpdate({
        target: incident.incidentId,
        set: {
          state: i.state,
          rcaAttached: i.rcaAttached,
          regressionCaseId: i.regressionCaseId,
          owner: i.owner,
        },
      });
  }
  async getIncident(incidentId) {
    const db = await this.h.ready();
    const [r] = await db.select().from(incident).where(eq6(incident.incidentId, incidentId));
    return r ?? null;
  }
};

// packages/persistence/dist/session-repository.js
import { eq as eq7 } from 'drizzle-orm';
var SessionRepository = class {
  h;
  constructor(h) {
    this.h = h;
  }
  async saveDiagnosticRun(r) {
    const db = await this.h.ready();
    await db
      .insert(diagnosticRun)
      .values(r)
      .onConflictDoUpdate({
        target: diagnosticRun.runId,
        set: { state: r.state, probesUsed: r.probesUsed, runVersion: r.runVersion },
      });
  }
  async getDiagnosticRun(runId) {
    const db = await this.h.ready();
    const [r] = await db.select().from(diagnosticRun).where(eq7(diagnosticRun.runId, runId));
    return r ?? null;
  }
  async saveTutoringSession(s) {
    const db = await this.h.ready();
    await db
      .insert(tutoringSession)
      .values(s)
      .onConflictDoUpdate({ target: tutoringSession.sessionId, set: { state: s.state } });
  }
  async getTutoringSession(sessionId) {
    const db = await this.h.ready();
    const [r] = await db
      .select()
      .from(tutoringSession)
      .where(eq7(tutoringSession.sessionId, sessionId));
    return r ?? null;
  }
  /** Durable at-most-once submission. Returns whether this was newly recorded. */
  async recordSubmission(clientSubmissionId, at) {
    const db = await this.h.ready();
    const res = await db
      .insert(submission)
      .values({ clientSubmissionId, at })
      .onConflictDoNothing()
      .returning({ id: submission.clientSubmissionId });
    return { accepted: res.length > 0 };
  }
};

// services/api/src/deps.ts
function buildDeps(opts = {}) {
  const env = opts.env ?? process.env;
  const config2 = loadConfig(env);
  const db = opts.db ?? openDatabaseFromEnv(env);
  return {
    config: config2,
    db,
    identity: new IdentityRepository(db),
    evidence: new EvidenceRepository(db),
    billing: new BillingRepository(db),
    content: new ContentRepository(db),
    safety: new SafetyRepository(db),
    operator: new OperatorRepository(db),
    session: new SessionRepository(db),
  };
}
var now = () => /* @__PURE__ */ new Date().toISOString();

// services/api/src/errors.ts
var STATUS = {
  AUTH_REQUIRED: 401,
  FORBIDDEN_ROLE: 403,
  CONSENT_REQUIRED: 403,
  ENTITLEMENT_INACTIVE: 402,
  REGION_DISALLOWED: 451,
  POLICY_BLOCKED: 422,
  SAFETY_BLOCKED: 403,
  VALIDATION_UNAVAILABLE: 503,
  LOW_EVIDENCE_CONFIDENCE: 422,
  STALE_VERSION: 409,
  CONFLICT: 409,
  NOT_FOUND: 404,
  RATE_LIMITED: 429,
  DEPENDENCY_UNAVAILABLE: 503,
  REVIEW_REQUIRED: 403,
};
function statusForCode(code) {
  return STATUS[code] ?? 400;
}
function onError(err, c) {
  if (isDomainError(err)) {
    return c.json({ code: err.code, message: err.message }, statusForCode(err.code));
  }
  return c.json({ code: 'INTERNAL', message: 'internal error' }, 500);
}

// services/api/src/auth.ts
import { jwtVerify, createRemoteJWKSet } from 'jose';
function readAuthConfig(env) {
  const mode = env.AUTH_MODE ?? 'dev';
  if (mode === 'dev') return { mode: 'dev' };
  if (mode !== 'jwt') throw new DomainError('POLICY_BLOCKED', `invalid AUTH_MODE: ${mode}`);
  const issuer = env.AUTH_JWT_ISSUER;
  const audience = env.AUTH_JWT_AUDIENCE;
  if (!issuer || !audience)
    throw new DomainError(
      'POLICY_BLOCKED',
      'AUTH_JWT_ISSUER and AUTH_JWT_AUDIENCE are required in jwt mode',
    );
  const secret = env.AUTH_JWT_SECRET;
  const jwksUrl = env.AUTH_JWKS_URL;
  if (!secret && !jwksUrl)
    throw new DomainError('POLICY_BLOCKED', 'jwt mode needs AUTH_JWT_SECRET or AUTH_JWKS_URL');
  return { mode: 'jwt', jwt: { issuer, audience, secret, jwksUrl } };
}
var jwksCache = /* @__PURE__ */ new Map();
function jwksFor(url) {
  let set = jwksCache.get(url);
  if (!set) {
    set = createRemoteJWKSet(new URL(url));
    jwksCache.set(url, set);
  }
  return set;
}
async function verifyToken(token, cfg) {
  const options = { issuer: cfg.issuer, audience: cfg.audience };
  if (cfg.jwksUrl) {
    const { payload: payload2 } = await jwtVerify(token, jwksFor(cfg.jwksUrl), options);
    return payload2;
  }
  const key = new TextEncoder().encode(cfg.secret);
  const { payload } = await jwtVerify(token, key, options);
  return payload;
}
function str(v) {
  return typeof v === 'string' && v.length > 0 ? v : void 0;
}
function fromClaims(p, defaultRegion) {
  const actorType = str(p.actor_type);
  const actorAlias = str(p.actor_alias) ?? str(p.sub);
  if (!actorType || !ACTOR_TYPES.includes(actorType) || !actorAlias)
    throw new DomainError('AUTH_REQUIRED', 'token missing a valid actor identity');
  const gr = str(p.guardian_role);
  const actor = {
    actorType,
    actorAlias,
    familyAlias: str(p.family_alias) ?? null,
    learnerAlias: str(p.learner_alias),
    purpose: str(p.purpose) ?? 'support',
  };
  return {
    actor,
    guardianRole: gr === 'owner' || gr === 'learning_viewer' ? gr : void 0,
    stepUp: p.step_up === true || p.step_up === 'true',
    region: str(p.processing_region) ?? defaultRegion,
  };
}
function fromHeaders(c, defaultRegion) {
  const actorType = c.req.header('x-actor-type');
  const actorAlias = c.req.header('x-actor-alias');
  if (!actorType || !actorAlias)
    throw new DomainError('AUTH_REQUIRED', 'x-actor-type and x-actor-alias are required');
  const gr = c.req.header('x-guardian-role');
  const actor = {
    actorType,
    actorAlias,
    familyAlias: c.req.header('x-family-alias') ?? null,
    learnerAlias: c.req.header('x-learner-alias') ?? void 0,
    purpose: c.req.header('x-purpose') ?? 'support',
  };
  return {
    actor,
    guardianRole: gr === 'owner' || gr === 'learning_viewer' ? gr : void 0,
    stepUp: c.req.header('x-step-up') === 'true',
    region: c.req.header('x-processing-region') ?? defaultRegion,
  };
}
var API_PREFIXES = ['/families', '/learners', '/billing', '/diagnostic', '/content', '/operator'];
function isApiPath(path) {
  return API_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}
function authMiddleware(cfg, defaultRegion) {
  return async (c, next) => {
    if (!isApiPath(c.req.path)) {
      await next();
      return;
    }
    let auth;
    if (cfg.mode === 'jwt') {
      const header = c.req.header('authorization') ?? '';
      const match = /^Bearer\s+(.+)$/i.exec(header);
      if (!match) throw new DomainError('AUTH_REQUIRED', 'bearer token required');
      let payload;
      try {
        payload = await verifyToken(match[1], cfg.jwt);
      } catch {
        throw new DomainError('AUTH_REQUIRED', 'invalid or expired token');
      }
      auth = fromClaims(payload, defaultRegion);
    } else {
      auth = fromHeaders(c, defaultRegion);
    }
    c.set('auth', auth);
    await next();
  };
}
function readAuth(c, defaultRegion) {
  const stored = c.get('auth');
  if (stored) return stored;
  return fromHeaders(c, defaultRegion ?? 'ca-central');
}
function requireActorType(a, ...types) {
  if (!types.includes(a.actor.actorType)) {
    throw new DomainError('FORBIDDEN_ROLE', `requires actor type: ${types.join(' | ')}`);
  }
}
function assertRegion(a) {
  if (!isApprovedRegion(a.region)) {
    throw new DomainError(
      'REGION_DISALLOWED',
      'processing region is outside the Canadian allowlist',
    );
  }
}

// packages/identity/dist/entities.js
var MIN_GRADE = 1;
var MAX_GRADE = 8;
function ageBandForGrade(grade) {
  if (!Number.isInteger(grade) || grade < MIN_GRADE || grade > MAX_GRADE) {
    throw new DomainError('POLICY_BLOCKED', 'grade is outside the Ontario G1-8 range');
  }
  if (grade <= 3) return 'primary';
  if (grade <= 6) return 'junior';
  return 'intermediate';
}

// packages/identity/dist/consent-ledger.js
var CONSENT_PURPOSES = [
  { id: 'account_identity', tier: 'core', basis: 'service' },
  { id: 'child_learning', tier: 'core', basis: 'consent', modality: 'text' },
  { id: 'child_safety', tier: 'core', basis: 'legal' },
  { id: 'service_operations', tier: 'core', basis: 'service' },
  { id: 'voice_interaction', tier: 'optional', basis: 'consent', modality: 'voice' },
  { id: 'vision_upload', tier: 'optional', basis: 'consent', modality: 'vision' },
  { id: 'school_evidence', tier: 'optional', basis: 'consent' },
  { id: 'parent_comms', tier: 'optional', basis: 'consent' },
  { id: 'product_improvement', tier: 'optional', basis: 'consent' },
  { id: 'billing', tier: 'optional', basis: 'contract' },
];
var DEF = new Map(CONSENT_PURPOSES.map((d) => [d.id, d]));

// services/api/src/routes/families.ts
function registerFamilies(app2, deps) {
  const ownerOnly = (c) => {
    const a = readAuth(c, deps.config.primaryRegion);
    requireActorType(a, 'guardian');
    if (a.guardianRole !== 'owner')
      throw new DomainError('FORBIDDEN_ROLE', 'account owner required');
    return a;
  };
  app2.post('/families', async (c) => {
    ownerOnly(c);
    const b = await c.req.json();
    await deps.identity.saveFamily({
      familyId: b.familyId,
      marketRegion: b.marketRegion,
      legalOwnerGuardianId: b.legalOwnerGuardianId,
      status: 'active',
    });
    await deps.identity.saveGuardian({
      guardianId: b.legalOwnerGuardianId,
      familyId: b.familyId,
      role: 'owner',
      status: 'active',
    });
    return c.json({ familyId: b.familyId }, 201);
  });
  app2.post('/families/:familyId/learners', async (c) => {
    ownerOnly(c);
    const familyId = c.req.param('familyId');
    const b = await c.req.json();
    const ageBand = ageBandForGrade(b.grade);
    await deps.identity.saveLearner({
      learnerId: b.learnerId,
      familyId,
      nickname: b.nickname,
      grade: b.grade,
      ageBand,
      lifecycleStatus: 'active',
    });
    return c.json({ learnerId: b.learnerId, ageBand }, 201);
  });
  app2.post('/families/:familyId/consent', async (c) => {
    ownerOnly(c);
    const familyId = c.req.param('familyId');
    const b = await c.req.json();
    await deps.identity.saveConsentGrant({
      grantId: b.grantId,
      familyId,
      purpose: b.purpose,
      version: b.version,
      modality: b.modality,
      state: 'GIVEN',
      grantedAt: now(),
      revokedAt: null,
    });
    return c.json({ grantId: b.grantId, state: 'GIVEN' }, 201);
  });
  app2.get('/families/:familyId/consent', async (c) => {
    const a = readAuth(c, deps.config.primaryRegion);
    requireActorType(a, 'guardian');
    return c.json({ grants: await deps.identity.listConsentGrants(c.req.param('familyId')) });
  });
  app2.post('/families/:familyId/consent/:grantId/revoke', async (c) => {
    ownerOnly(c);
    const familyId = c.req.param('familyId');
    const grantId = c.req.param('grantId');
    const grant = (await deps.identity.listConsentGrants(familyId)).find(
      (g) => g.grantId === grantId,
    );
    if (!grant) throw new DomainError('NOT_FOUND', 'consent grant not found');
    await deps.identity.saveConsentGrant({ ...grant, state: 'REVOKED', revokedAt: now() });
    return c.json({ grantId, state: 'REVOKED' });
  });
}

// packages/learner-state/dist/evidence.js
var MIN_TRUSTED_RECOGNITION = 0.75;

// packages/learner-state/dist/policy.js
var DRAFT_MASTERY_POLICY = {
  policyVersion: 'mastery-DRAFT-0.1(ER-03-UNCALIBRATED)',
  minUnaidedForIndependent: 3,
  minRepresentationsForIndependent: 2,
  retentionDelayMs: 24 * 60 * 60 * 1e3,
  // 24h placeholder
  unaidedBands: ['A0', 'A1'],
};

// packages/learner-state/dist/projection.js
function isUnaided(band, policy) {
  return policy.unaidedBands.includes(band);
}
function trustedEvents(events, corrections) {
  const retracted = new Set(corrections.filter((c) => c.retract).map((c) => c.targetEventId));
  return events.filter(
    (e) => !retracted.has(e.eventId) && e.recognitionConfidence >= MIN_TRUSTED_RECOGNITION,
  );
}
function projectShadow(
  learnerAlias,
  skillId,
  events,
  corrections = [],
  policy = DRAFT_MASTERY_POLICY,
) {
  const scoped = trustedEvents(events, corrections).filter(
    (e) => e.learnerAlias === learnerAlias && e.skillId === skillId,
  );
  const releaseId =
    scoped.length > 0 ? (scoped[scoped.length - 1]?.curriculumReleaseId ?? null) : null;
  const base = {
    learnerAlias,
    skillId,
    policyVersion: policy.policyVersion,
    curriculumReleaseId: releaseId,
    evidenceCount: scoped.length,
  };
  if (scoped.length === 0) {
    return {
      ...base,
      state: 'UNASSESSED',
      dimensions: {
        independent: false,
        retained: false,
        transferable: false,
        representationsCovered: 0,
        unaidedCorrect: 0,
      },
      confidence: 0,
    };
  }
  const unaidedCorrect = scoped.filter((e) => e.correct && isUnaided(e.assistanceBand, policy));
  const representations = new Set(unaidedCorrect.map((e) => e.representation));
  const representationsCovered = representations.size;
  const independent =
    unaidedCorrect.length >= policy.minUnaidedForIndependent &&
    representationsCovered >= policy.minRepresentationsForIndependent;
  const firstUnaidedAt =
    unaidedCorrect.length > 0
      ? Math.min(...unaidedCorrect.map((e) => Date.parse(e.observedAt)))
      : Number.POSITIVE_INFINITY;
  const retained =
    independent &&
    scoped.some(
      (e) =>
        e.mode === 'retention_check' &&
        e.correct &&
        isUnaided(e.assistanceBand, policy) &&
        Date.parse(e.observedAt) - firstUnaidedAt >= policy.retentionDelayMs,
    );
  const transferable =
    (retained || independent) &&
    scoped.some(
      (e) => e.mode === 'transfer_check' && e.correct && isUnaided(e.assistanceBand, policy),
    );
  const contradicted =
    independent &&
    scoped.some(
      (e) =>
        !e.correct &&
        isUnaided(e.assistanceBand, policy) &&
        e.mode === 'independent_check' &&
        Date.parse(e.observedAt) > firstUnaidedAt,
    );
  let state;
  if (contradicted) state = 'REVALIDATION_REQUIRED';
  else if (transferable) state = 'TRANSFERABLE';
  else if (retained) state = 'RETAINED';
  else if (independent) state = 'INDEPENDENT';
  else if (unaidedCorrect.length > 0 || scoped.some((e) => e.correct)) state = 'DEVELOPING';
  else state = 'EMERGING';
  const confidence = Math.min(
    1,
    unaidedCorrect.length / Math.max(1, policy.minUnaidedForIndependent) / 2 +
      representationsCovered / Math.max(1, policy.minRepresentationsForIndependent) / 2,
  );
  return {
    ...base,
    state,
    dimensions: {
      independent,
      retained,
      transferable,
      representationsCovered,
      unaidedCorrect: unaidedCorrect.length,
    },
    confidence: Number(confidence.toFixed(2)),
  };
}

// packages/domain-core/dist/content-gate.js
function decideDelivery(candidate, fallback) {
  if (candidate.verdict === 'PASS') {
    if (!candidate.validationRecordRef) {
      throw new DomainError('POLICY_BLOCKED', 'PASS requires a signed validation record');
    }
    return { kind: 'DELIVER', candidateId: candidate.candidateId };
  }
  if (fallback) {
    return { kind: 'FALLBACK', assetId: fallback.assetId };
  }
  return {
    kind: 'BLOCK',
    reason: candidate.verdict === 'UNAVAILABLE' ? 'VALIDATION_UNAVAILABLE' : 'SAFETY_BLOCKED',
  };
}

// packages/diagnostic/dist/policy.js
var DRAFT_DIAGNOSTIC_POLICY = {
  policyVersion: 'diag-DRAFT-0.1(ER-DIA-UNCALIBRATED)',
  sufficientConfidence: 0.8,
  minProbeScore: 0.15,
  attentionBudget: 12,
  weights: {
    infoGain: 0.5,
    foundational: 0.25,
    gradeRelevance: 0.15,
    diversity: 0.1,
  },
};

// packages/diagnostic/dist/selection.js
function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}
function scoreCandidate(c, learnerGrade, policy) {
  if (!c.valid) return Number.NEGATIVE_INFINITY;
  if (c.priorConfidence >= policy.sufficientConfidence) return 0;
  const w = policy.weights;
  const infoGain = 1 - clamp01(c.priorConfidence);
  const foundational = clamp01(c.foundationalFanout / 4);
  const gradeRelevance = 1 - clamp01(Math.abs(c.grade - learnerGrade) / 8);
  const diversityPenalty = clamp01(c.representationsCovered / 3);
  return (
    w.infoGain * infoGain +
    w.foundational * foundational +
    w.gradeRelevance * gradeRelevance -
    w.diversity * diversityPenalty
  );
}
function scoreAll(candidates, learnerGrade, policy) {
  return candidates
    .filter((c) => c.valid)
    .map((c) => ({ candidate: c, score: scoreCandidate(c, learnerGrade, policy) }))
    .sort((a, b) =>
      b.score !== a.score
        ? b.score - a.score
        : a.candidate.skillId.localeCompare(b.candidate.skillId),
    );
}
function selectNextProbe(candidates, learnerGrade, policy) {
  const ranked = scoreAll(candidates, learnerGrade, policy);
  const top = ranked[0];
  if (!top || top.score < policy.minProbeScore) return null;
  return top.candidate;
}

// packages/diagnostic/dist/profile.js
function classifyStanding(p) {
  switch (p.state) {
    case 'UNASSESSED':
      return 'unknown';
    case 'EMERGING':
      return 'emerging';
    case 'DEVELOPING':
      return 'developing';
    case 'INDEPENDENT':
    case 'RETAINED':
    case 'TRANSFERABLE':
      return 'demonstrated';
    case 'REVALIDATION_REQUIRED':
      return 'needs_review';
    default: {
      const _never = p.state;
      return 'unknown';
    }
  }
}

// packages/parent/dist/dashboard.js
function buildDashboard(learnerAlias, projections) {
  const rows = projections.map((p) => ({
    skillId: p.skillId,
    standing: classifyStanding(p),
    confidence: p.confidence,
    evidenceCount: p.evidenceCount,
  }));
  return { learnerAlias, rows };
}

// packages/planner/dist/policy.js
var DRAFT_PLANNER_POLICY = {
  policyVersion: 'planner-DRAFT-0.1(ER-03/08/09-UNCALIBRATED)',
  verifyConfidence: 0.5,
  sufficientConfidence: 0.8,
  stallAttempts: 2,
  retentionDecayWindowMs: 21 * 24 * 60 * 60 * 1e3,
  // 21-day placeholder
  maxNewConceptsPerSession: 2,
  maxSessionItems: 8,
};

// services/api/src/routes/learning.ts
async function assertLearningConsent(deps, familyAlias) {
  if (!familyAlias)
    throw new DomainError('CONSENT_REQUIRED', 'x-family-alias required to check consent');
  const grants = await deps.identity.listConsentGrants(familyAlias);
  const ok = grants.some((g) => g.purpose === 'child_learning' && g.state === 'GIVEN');
  if (!ok)
    throw new DomainError('CONSENT_REQUIRED', 'no active child_learning consent for this family');
}
async function projectionFor(deps, learnerAlias, skillId) {
  const events = await deps.evidence.listEvidence(learnerAlias, skillId);
  const corrections = await deps.evidence.listCorrections(events.map((e) => e.eventId));
  return projectShadow(learnerAlias, skillId, events, corrections);
}
function registerLearning(app2, deps) {
  const authed = (c) => {
    const a = readAuth(c, deps.config.primaryRegion);
    assertRegion(a);
    return a;
  };
  app2.post('/learners/:alias/skills/:skillId/evidence', async (c) => {
    const a = authed(c);
    requireActorType(a, 'evidence_producer', 'tutor_engine');
    await assertLearningConsent(deps, a.actor.familyAlias);
    const alias = c.req.param('alias');
    const skillId = c.req.param('skillId');
    const b = await c.req.json();
    await deps.evidence.appendEvidence({ ...b, learnerAlias: alias, skillId });
    return c.json({ accepted: true, eventId: b.eventId }, 202);
  });
  app2.get('/learners/:alias/skills/:skillId/projection', async (c) => {
    authed(c);
    const projection = await projectionFor(deps, c.req.param('alias'), c.req.param('skillId'));
    return c.json({ projection });
  });
  app2.get('/learners/:alias/dashboard', async (c) => {
    const a = authed(c);
    requireActorType(a, 'guardian');
    const alias = c.req.param('alias');
    const skills = (c.req.query('skills') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const projections = [];
    for (const skillId of skills) projections.push(await projectionFor(deps, alias, skillId));
    return c.json(buildDashboard(alias, projections));
  });
  app2.post('/diagnostic/next-probe', async (c) => {
    authed(c);
    const b = await c.req.json();
    const probe = selectNextProbe(b.candidates, b.learnerGrade, DRAFT_DIAGNOSTIC_POLICY);
    return c.json({ probe });
  });
  app2.post('/content/deliver', async (c) => {
    authed(c);
    const b = await c.req.json();
    const outcome = decideDelivery(b.candidate, b.fallback ?? null);
    return c.json({ outcome });
  });
}

// packages/billing/dist/entitlement.js
var TRANSITIONS = {
  TRIAL_ACTIVE: ['TRIAL_EXPIRED', 'PAID_ACTIVE'],
  TRIAL_EXPIRED: ['INACTIVE', 'PAID_ACTIVE'],
  INACTIVE: ['PAID_ACTIVE'],
  PAID_ACTIVE: ['PAST_DUE_GRACE', 'CANCEL_SCHEDULED', 'PAID_EXPIRED'],
  PAST_DUE_GRACE: ['PAID_ACTIVE', 'PAID_EXPIRED'],
  CANCEL_SCHEDULED: ['PAID_ACTIVE', 'PAID_EXPIRED'],
  PAID_EXPIRED: ['PAID_ACTIVE', 'INACTIVE'],
};
function transitionEntitlement(from, to) {
  if (from === to) return to;
  if (!TRANSITIONS[from].includes(to)) {
    throw new DomainError('CONFLICT', `illegal entitlement transition ${from} -> ${to}`);
  }
  return to;
}

// packages/billing/dist/transitions.js
function confirmUpgrade(from) {
  return {
    state: transitionEntitlement(from, 'PAID_ACTIVE'),
    effective: 'IMMEDIATE',
    evidenceTouched: false,
  };
}

// services/api/src/routes/commerce.ts
function registerCommerce(app2, deps) {
  app2.post('/billing/callbacks', async (c) => {
    const a = readAuth(c, deps.config.primaryRegion);
    requireActorType(a, 'billing_service', 'system');
    const b = await c.req.json();
    const res = await deps.billing.recordCallback({ ...b, at: now() });
    if (res.applied && b.kind === 'grant') {
      const current = await deps.billing.getEntitlement(b.familyId);
      const next = confirmUpgrade(current?.state ?? 'INACTIVE');
      await deps.billing.saveEntitlement({
        familyId: b.familyId,
        state: next.state,
        tierId: current?.tierId ?? null,
        updatedAt: now(),
      });
    }
    return c.json(res);
  });
  app2.get('/families/:familyId/entitlement', async (c) => {
    const a = readAuth(c, deps.config.primaryRegion);
    requireActorType(a, 'guardian', 'billing_service', 'system');
    const entitlement2 = await deps.billing.getEntitlement(c.req.param('familyId'));
    return c.json({ entitlement: entitlement2 });
  });
}

// services/api/src/routes/ops.ts
function registerOps(app2, deps) {
  app2.post('/operator/kill-switch', async (c) => {
    const a = readAuth(c, deps.config.primaryRegion);
    requireActorType(a, 'operator');
    const b = await c.req.json();
    const at = now();
    await deps.operator.setKillSwitch({
      capability: b.capability,
      disabled: b.disabled,
      actor: a.actor.actorAlias,
      reason: b.reason,
      at,
    });
    await deps.safety.recordAudit({
      approver: a.actor.actorAlias,
      reason: b.reason,
      object: b.capability,
      action: b.disabled ? 'kill_switch_disable' : 'kill_switch_enable',
      outcome: 'EXECUTED',
      expiry: null,
      at,
    });
    return c.json({ capability: b.capability, active: !b.disabled });
  });
  app2.get('/operator/kill-switch/:capability', async (c) => {
    const a = readAuth(c, deps.config.primaryRegion);
    requireActorType(a, 'operator');
    return c.json({
      capability: c.req.param('capability'),
      active: await deps.operator.isCapabilityActive(c.req.param('capability')),
    });
  });
  app2.post('/operator/quarantine', async (c) => {
    const a = readAuth(c, deps.config.primaryRegion);
    requireActorType(a, 'operator', 'child_safety');
    const b = await c.req.json();
    const at = now();
    const regressionCaseId = `RC-${Date.now()}-${b.assetId}`;
    await deps.content.quarantine({
      assetId: b.assetId,
      assetVersion: b.assetVersion,
      reasonCode: b.reasonCode,
      actor: a.actor.actorAlias,
      at,
      regressionCaseId,
    });
    await deps.safety.recordAudit({
      approver: a.actor.actorAlias,
      reason: b.reasonCode,
      object: b.assetId,
      action: 'content_quarantine',
      outcome: 'EXECUTED',
      expiry: null,
      at,
    });
    return c.json({ quarantined: true, regressionCaseId });
  });
}

// services/api/src/app.ts
function createApp(opts = {}) {
  const deps = buildDeps(opts);
  const app2 = new Hono();
  app2.onError(onError);
  app2.get('/healthz', (c) => c.json({ status: 'ok' }));
  app2.get('/readyz', (c) =>
    c.json({
      status: 'ready',
      environment: deps.config.environment,
      primaryRegion: deps.config.primaryRegion,
      drRegion: deps.config.drRegion,
      modules: DOMAIN_MODULES.length,
    }),
  );
  app2.use('*', authMiddleware(readAuthConfig(opts.env ?? process.env), deps.config.primaryRegion));
  registerFamilies(app2, deps);
  registerLearning(app2, deps);
  registerCommerce(app2, deps);
  registerOps(app2, deps);
  if (opts.webRoot) {
    app2.get('*', serveStatic({ root: opts.webRoot }));
  }
  return app2;
}

// services/api/src/server.ts
var app = createApp({ webRoot: process.env.POTENOVA_WEB_ROOT });
var config = loadConfig(process.env);
var port = Number(process.env.PORT ?? 8080);
serve({ fetch: app.fetch, port }, () => {
  console.log(`potenova api on :${port} [${config.environment}, ${config.primaryRegion}]`);
});
