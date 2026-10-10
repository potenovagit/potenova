import { pgTable, text, boolean, doublePrecision, timestamp } from 'drizzle-orm/pg-core';

/**
 * Evidence-ledger schema (WP-03 persistence; ADR-0002, ADR-0017).
 *
 * Append-only by construction: the repository exposes inserts and selects only —
 * no update or delete — so an observation, once recorded, is immutable. A
 * correction is a NEW row in `evidence_correction`, never a mutation of the
 * observation it concerns (LRN-003; the non-negotiable immutable-evidence rule).
 *
 * The same Drizzle schema runs on PGlite (dev/test, in-process) and on managed
 * PostgreSQL in Canada (production) — only the driver/connection changes.
 */

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
  ingestedAt: timestamp('ingested_at', { withTimezone: true }).notNull().defaultNow(),
});

/** DDL applied at repository init (dev/test). Production uses migrations (ADR-0017). */
export const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS mastery_evidence (
  event_id text PRIMARY KEY,
  learner_alias text NOT NULL,
  skill_id text NOT NULL,
  mode text NOT NULL,
  assistance_band text NOT NULL,
  correct boolean NOT NULL,
  representation text NOT NULL,
  recognition_confidence double precision NOT NULL,
  observed_at text NOT NULL,
  curriculum_release_id text NOT NULL,
  schema_version text NOT NULL,
  ingested_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_evidence_learner_skill ON mastery_evidence (learner_alias, skill_id);
CREATE TABLE IF NOT EXISTS evidence_correction (
  correction_id text PRIMARY KEY,
  target_event_id text NOT NULL,
  reason text NOT NULL,
  retract boolean NOT NULL,
  created_at text NOT NULL,
  ingested_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_correction_target ON evidence_correction (target_event_id);
`;
