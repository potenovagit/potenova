import { type ActorContext, DomainError } from '@potenova/contracts';

/**
 * Append-only learner-evidence ledger.
 *
 * LOCKED invariant (LRN-003; Architecture invariants §1.1; State machine 3.1;
 * AT-06; C-08): a recorded observation is immutable. Corrections APPEND a linked
 * correction/retraction event; they never mutate or delete history. Only trusted,
 * signed evidence producers may append (not parents/children directly).
 *
 * This reference ledger is intentionally storage-agnostic (an array stands in for
 * the eventual append-only store — see ADR-0003). It exists to make the
 * immutability + correction semantics executable and testable now.
 */

export interface EvidenceEvent {
  readonly eventId: string;
  readonly learnerAlias: string;
  readonly skillId: string;
  readonly assistanceBand: 'A0' | 'A1' | 'A2' | 'A3' | 'A4' | 'A5';
  /** Transcription/recognition certainty 0..1 (vision/voice). */
  readonly recognitionConfidence: number;
  readonly schemaVersion: string;
}

export interface EvidenceCorrection {
  readonly correctionId: string;
  readonly targetEventId: string;
  readonly reason: string;
}

type LedgerRecord =
  | { readonly kind: 'event'; readonly event: EvidenceEvent }
  | { readonly kind: 'correction'; readonly correction: EvidenceCorrection };

export class EvidenceLedger {
  readonly #records: LedgerRecord[] = [];
  readonly #eventIds = new Set<string>();

  /** Append an immutable evidence event (idempotent on eventId). */
  append(actor: ActorContext, event: EvidenceEvent): void {
    if (actor.actorType !== 'evidence_producer') {
      // Parents/children/tutor-UI cannot write evidence directly. (C-08)
      throw new DomainError('FORBIDDEN_ROLE', 'only trusted evidence producers may append');
    }
    if (this.#eventIds.has(event.eventId)) {
      // Replay of a known nonce returns the original — no duplicate. (C-07, AT-27)
      return;
    }
    this.#eventIds.add(event.eventId);
    this.#records.push({ kind: 'event', event: Object.freeze({ ...event }) });
  }

  /** Correct an earlier event by APPENDING a linked correction. */
  correct(actor: ActorContext, correction: EvidenceCorrection): void {
    if (actor.actorType !== 'evidence_producer' && actor.actorType !== 'content_validator') {
      throw new DomainError('FORBIDDEN_ROLE', 'correction requires an authorised reviewer');
    }
    if (!this.#eventIds.has(correction.targetEventId)) {
      throw new DomainError('NOT_FOUND', 'target evidence event does not exist');
    }
    this.#records.push({ kind: 'correction', correction: Object.freeze({ ...correction }) });
  }

  /** Full, ordered, read-only history (events + corrections). */
  history(): readonly LedgerRecord[] {
    return this.#records.slice();
  }

  eventCount(): number {
    return this.#records.filter((r) => r.kind === 'event').length;
  }
}
