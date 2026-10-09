/**
 * Identity & Family canonical entities (WP-01).
 * Source: 03_Canonical_Domain_State_Machines.md §2; requirements ACC-001..013.
 *
 * Structural shapes only — storage technology is ADR-0002 (PostgreSQL). All
 * identifiers are opaque aliases; no exact DOB, legal name, school or precise
 * location is modelled (PRIV-001).
 */
import { DomainError } from '@potenova/contracts';

/** Guardian roles (ACC-004/005). Owner is the single legal account owner. */
export const GUARDIAN_ROLES = ['owner', 'learning_viewer'] as const;
export type GuardianRole = (typeof GUARDIAN_ROLES)[number];

export type AccountStatus = 'active' | 'suspended' | 'closed';

export interface FamilyAccount {
  readonly familyId: string;
  readonly marketRegion: string; // MVP: Ontario → 'ca-on'
  readonly legalOwnerGuardianId: string;
  readonly status: AccountStatus;
}

export interface Guardian {
  readonly guardianId: string;
  readonly familyId: string;
  readonly role: GuardianRole;
  /** Whether the current auth context has satisfied step-up re-verification. */
  readonly status: AccountStatus;
}

export interface GuardianRoleGrant {
  readonly grantId: string;
  readonly familyId: string;
  readonly subjectGuardianId: string;
  readonly role: GuardianRole;
  readonly grantedByGuardianId: string;
  readonly expiresAt: string | null;
}

/**
 * Age-band taxonomy (F-08, accepted 2026-10-09).
 * Aligned to Ontario's curriculum divisions so the band maps cleanly from the
 * registered grade (which we collect) rather than an exact DOB (which we do not,
 * PRIV-001). Band STRUCTURE + grade mapping are final here; the per-band
 * behavioural parameters — session/daily caps and safety-escalation matrices —
 * remain EVIDENCE REQUIRED (ER-09 / ER-08) and are NOT encoded here.
 *
 *   primary       Grades 1-3  (~ages 6-8)
 *   junior        Grades 4-6  (~ages 9-11)
 *   intermediate  Grades 7-8  (~ages 12-14)
 */
export const AGE_BANDS = ['primary', 'junior', 'intermediate'] as const;
export type AgeBand = (typeof AGE_BANDS)[number];

export const MIN_GRADE = 1;
export const MAX_GRADE = 8;

/** Derive the age band from the registered grade (Ontario G1-8). */
export function ageBandForGrade(grade: number): AgeBand {
  if (!Number.isInteger(grade) || grade < MIN_GRADE || grade > MAX_GRADE) {
    throw new DomainError('POLICY_BLOCKED', 'grade is outside the Ontario G1-8 range');
  }
  if (grade <= 3) return 'primary';
  if (grade <= 6) return 'junior';
  return 'intermediate';
}

/**
 * Conservative, DOB-free approximation of whether a learner is confidently
 * under 13, for FUTURE app-store / U.S.-COPPA handling (ER-13 / ER-14) only.
 * It is not used to gate any MVP behaviour — every G1-8 learner receives full
 * child protections regardless. Grades 1-7 are confidently under 13; Grade 8
 * (~13-14) is the boundary cohort and returns false.
 */
export function under13ByGrade(grade: number): boolean {
  ageBandForGrade(grade); // validate range (throws on out-of-range)
  return grade <= 7;
}

export interface LearnerProfile {
  readonly learnerId: string;
  readonly familyId: string;
  readonly nickname: string;
  readonly grade: number;
  /** Derived from `grade` via `ageBandForGrade` — not independently supplied. */
  readonly ageBand: AgeBand;
  readonly lifecycleStatus: 'active' | 'deleted';
}

export interface ChildSessionCredential {
  readonly credentialId: string;
  readonly learnerId: string;
  readonly familyId: string;
  readonly deviceIdAlias: string;
  readonly expiresAt: string;
  readonly riskState: 'known' | 'unknown_device';
}
