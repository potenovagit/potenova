import { type Purpose, DomainError } from '@potenova/contracts';
import { assertProcessingAllowed, type ConsentGrant } from '@potenova/domain-core';

/**
 * Consent ledger (WP-01) — versioned, purpose-scoped, independently revocable.
 * Source: PRIV-004; ConsentGrant state machine 3.6; C-02; TM-46; AT-01/34.
 *
 * Wraps the domain-core consent fence with a per-learner, per-(purpose,modality)
 * ledger so a guardian can revoke ONE optional modality (e.g. voice) while core
 * learning continues (AT-34).
 *
 * PROVISIONAL taxonomy pending F-07: the set of consent modalities below is a
 * placeholder. The structure (purpose × modality, versioned, independently
 * revocable) is final; the literal modality list MUST be replaced from the
 * signed F-07 consent purpose/modality taxonomy before WP-01 exit.
 */
export const PROVISIONAL_MODALITIES = ['text', 'voice', 'vision'] as const;
export type Modality = (typeof PROVISIONAL_MODALITIES)[number];

interface LedgerEntry {
  purpose: Purpose;
  modality: Modality | null; // null = purpose-level grant (no modality split)
  state: ConsentGrant['state'];
  noticeVersion: string;
}

export class ConsentLedger {
  /** keyed by learnerAlias → entries */
  readonly #byLearner = new Map<string, LedgerEntry[]>();

  /** C-02: record a guardian consent grant (GIVEN). */
  grant(
    learnerAlias: string,
    purpose: Purpose,
    noticeVersion: string,
    modality: Modality | null = null,
  ): void {
    const entries = this.#byLearner.get(learnerAlias) ?? [];
    entries.push({ purpose, modality, state: 'GIVEN', noticeVersion });
    this.#byLearner.set(learnerAlias, entries);
  }

  /** Revoke a single purpose (optionally a single modality of it) — TM-46 fence. */
  revoke(learnerAlias: string, purpose: Purpose, modality: Modality | null = null): void {
    const entries = this.#byLearner.get(learnerAlias);
    if (!entries) throw new DomainError('NOT_FOUND', 'no consent entries for learner');
    let changed = false;
    for (const e of entries) {
      if (e.purpose === purpose && e.modality === modality && e.state === 'GIVEN') {
        e.state = 'REVOKED';
        changed = true;
      }
    }
    if (!changed) throw new DomainError('NOT_FOUND', 'no matching active grant');
  }

  /** Current grants for a learner, as domain-core ConsentGrant shapes. */
  grantsFor(learnerAlias: string): readonly ConsentGrant[] {
    return (this.#byLearner.get(learnerAlias) ?? []).map((e) => ({
      purpose: e.purpose,
      state: e.state,
      noticeVersion: e.noticeVersion,
    }));
  }

  /**
   * Assert processing for a purpose is permitted (delegates to the domain-core
   * fail-closed fence). Throws CONSENT_REQUIRED when no active grant exists.
   */
  assertAllowed(learnerAlias: string, purpose: Purpose): void {
    assertProcessingAllowed(purpose, this.grantsFor(learnerAlias));
  }

  /** Whether a specific modality of a purpose is currently granted (AT-34). */
  isModalityAllowed(learnerAlias: string, purpose: Purpose, modality: Modality): boolean {
    const entries = this.#byLearner.get(learnerAlias) ?? [];
    return entries.some(
      (e) => e.purpose === purpose && e.modality === modality && e.state === 'GIVEN',
    );
  }
}
