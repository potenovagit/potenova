import { DomainError } from '@potenova/contracts';
import type { ConsentState } from '@potenova/domain-core';

/**
 * Consent ledger (WP-01) — F-07 consent purpose/modality taxonomy (accepted
 * 2026-10-09). Versioned, purpose-scoped, independently revocable.
 * Source: PRIV-004; ConsentGrant state machine 3.6; C-02; TM-46; AT-01/34.
 *
 * Relationship to the domain-core consent fence: that fence is the generic,
 * operational-purpose primitive (checked at request time, e.g. by tutoring/AI);
 * this ledger is the parent-facing CONSENT taxonomy layer. The mapping from an
 * operational purpose to the consent purpose(s) it requires is a documented
 * WP-04 seam.
 *
 * STRUCTURE is final. The per-purpose lawful BASIS and retention remain
 * EVIDENCE REQUIRED (ER-10 / ER-07, Privacy/Legal); `basis` here is the accepted
 * engineering intent, not a legal determination.
 */

export type ConsentPurpose =
  // core — bundled into the versioned onboarding consent; service unusable without them
  | 'account_identity' // run the family account + guardian identities
  | 'child_learning' // tutoring + diagnostic + evidence/mastery loop (text)
  | 'child_safety' // independent safety layer (not opt-out-able)
  | 'service_operations' // privacy-minimized reliability + security audit
  // optional — separately granted, revocable without touching core learning (AT-34)
  | 'voice_interaction' // STT + read-aloud  (owns the `voice` modality)
  | 'vision_upload' // camera/photo/file + OCR  (owns the `vision` modality)
  | 'school_evidence' // use of uploaded school docs, parent-confirmed (needs vision)
  | 'parent_comms' // weekly-summary email / push to the guardian
  | 'product_improvement' // aggregate, non-identifiable signals only (never trains models)
  // contract basis — parent-only, applies when a subscription exists
  | 'billing';

export type ConsentTier = 'core' | 'optional';
export type LawfulBasis = 'consent' | 'service' | 'legal' | 'contract';

/** The child's sensory channels. `text` is the core channel; voice/vision optional. */
export const MODALITIES = ['text', 'voice', 'vision'] as const;
export type Modality = (typeof MODALITIES)[number];

export interface ConsentPurposeDef {
  readonly id: ConsentPurpose;
  readonly tier: ConsentTier;
  readonly basis: LawfulBasis;
  /** The sensory modality this purpose owns, when it is a modality-bearing one. */
  readonly modality?: Modality;
}

export const CONSENT_PURPOSES: readonly ConsentPurposeDef[] = [
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

const DEF = new Map<ConsentPurpose, ConsentPurposeDef>(CONSENT_PURPOSES.map((d) => [d.id, d]));

/** Which consent purpose owns each modality (text→child_learning, etc.). */
const MODALITY_OWNER: Record<Modality, ConsentPurpose> = {
  text: 'child_learning',
  voice: 'voice_interaction',
  vision: 'vision_upload',
};

/** A purpose needs an explicit guardian grant only when its basis is `consent`. */
export function requiresGrant(purpose: ConsentPurpose): boolean {
  return (DEF.get(purpose)?.basis ?? 'consent') === 'consent';
}

interface LedgerEntry {
  purpose: ConsentPurpose;
  state: ConsentState;
  noticeVersion: string;
}

export class ConsentLedger {
  readonly #byLearner = new Map<string, LedgerEntry[]>();

  /** C-02: record a guardian consent grant (GIVEN) for a purpose. */
  grant(learnerAlias: string, purpose: ConsentPurpose, noticeVersion: string): void {
    if (!DEF.has(purpose)) throw new DomainError('POLICY_BLOCKED', 'unknown consent purpose');
    const entries = this.#byLearner.get(learnerAlias) ?? [];
    entries.push({ purpose, state: 'GIVEN', noticeVersion });
    this.#byLearner.set(learnerAlias, entries);
  }

  /** Revoke a single purpose — independent of the others (AT-34 / TM-46 fence). */
  revoke(learnerAlias: string, purpose: ConsentPurpose): void {
    const entries = this.#byLearner.get(learnerAlias);
    let changed = false;
    for (const e of entries ?? []) {
      if (e.purpose === purpose && e.state === 'GIVEN') {
        e.state = 'REVOKED';
        changed = true;
      }
    }
    if (!changed) throw new DomainError('NOT_FOUND', 'no matching active grant');
  }

  /** Whether a consent-basis purpose currently has a GIVEN grant. */
  isGranted(learnerAlias: string, purpose: ConsentPurpose): boolean {
    return (this.#byLearner.get(learnerAlias) ?? []).some(
      (e) => e.purpose === purpose && e.state === 'GIVEN',
    );
  }

  /**
   * Assert processing for a purpose is permitted (fail-closed). Purposes whose
   * basis is not `consent` (service/legal/contract) are permitted by that basis
   * and need no grant; consent-basis purposes require a GIVEN grant.
   *
   * @throws DomainError CONSENT_REQUIRED — consent-basis purpose with no active grant
   */
  assertAllowed(learnerAlias: string, purpose: ConsentPurpose): void {
    if (!requiresGrant(purpose)) return;
    if (!this.isGranted(learnerAlias, purpose)) {
      throw new DomainError('CONSENT_REQUIRED', 'no active consent for this purpose');
    }
  }

  /** Whether a sensory modality is currently available (its owning purpose GIVEN). AT-34. */
  isModalityAllowed(learnerAlias: string, modality: Modality): boolean {
    return this.isGranted(learnerAlias, MODALITY_OWNER[modality]);
  }
}
