/**
 * Identity & Family canonical entities (WP-01).
 * Source: 03_Canonical_Domain_State_Machines.md §2; requirements ACC-001..013.
 *
 * Structural shapes only — storage technology is ADR-0002 (PostgreSQL). All
 * identifiers are opaque aliases; no exact DOB, legal name, school or precise
 * location is modelled (PRIV-001).
 */

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
 * Age band is a PROVISIONAL taxonomy pending F-08 (age-band + grade mapping).
 * The structure is final; the literal values are placeholders and MUST be
 * replaced from the signed F-08 taxonomy before WP-01 exit.
 */
export const PROVISIONAL_AGE_BANDS = ['6-8', '9-11'] as const;
export type AgeBand = (typeof PROVISIONAL_AGE_BANDS)[number];

export interface LearnerProfile {
  readonly learnerId: string;
  readonly familyId: string;
  readonly nickname: string;
  readonly grade: number;
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
