import { DomainError } from '@potenova/contracts';
import type { SensitivityClass } from './policy';

/**
 * Privacy Impact Assessment inventory (GOV-004; SEC-"PIA"; PRIV-001..005).
 *
 * A complete child-data processing inventory and signed PIA are mandatory BEFORE
 * controlled family beta. Each data flow records its element/category, purpose,
 * legal/consent basis, sensitivity, retention and subprocessor. The beta gate is
 * blocked until every flow is complete and an accountable owner has signed off.
 */

export interface PiaEntry {
  readonly dataElement: string;
  readonly category: string;
  readonly purpose: string;
  readonly legalBasis: string;
  readonly sensitivity: SensitivityClass;
  readonly retention: string;
  readonly subprocessor: string | null;
}

export interface PiaInventory {
  readonly version: string;
  readonly entries: readonly PiaEntry[];
  readonly signedOffBy: string | null;
}

function entryComplete(e: PiaEntry): boolean {
  return Boolean(e.dataElement && e.category && e.purpose && e.legalBasis && e.retention);
}

export interface PiaReadiness {
  readonly ready: boolean;
  readonly incompleteElements: readonly string[];
  readonly signed: boolean;
}

/** Assess PIA readiness for the beta gate (GOV-004) without throwing. */
export function assessPia(pia: PiaInventory): PiaReadiness {
  const incompleteElements = pia.entries.filter((e) => !entryComplete(e)).map((e) => e.dataElement);
  return {
    ready: incompleteElements.length === 0 && Boolean(pia.signedOffBy),
    incompleteElements,
    signed: Boolean(pia.signedOffBy),
  };
}

/**
 * Beta gate (GOV-004): a non-negotiable check that the PIA is complete and signed.
 *
 * @throws DomainError REVIEW_REQUIRED — the PIA is incomplete or unsigned.
 */
export function assertPiaReadyForBeta(pia: PiaInventory): void {
  const r = assessPia(pia);
  if (!r.ready) {
    throw new DomainError(
      'REVIEW_REQUIRED',
      r.signed
        ? 'PIA inventory is incomplete'
        : 'PIA requires accountable-owner sign-off before beta',
    );
  }
}
