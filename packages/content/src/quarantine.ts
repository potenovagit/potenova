import { DomainError } from '@potenova/contracts';

/**
 * Content quarantine + human review (CONT-007; AT-49; Architecture §3.4).
 *
 * Quarantine makes a failed, challenged or low-quality asset non-selectable in
 * production, records the action and version for audit, and opens a regression case
 * so the failure is pinned as a test going forward. Quarantine is a one-way action
 * here: an asset is never un-quarantined in place — a corrected, re-versioned asset
 * re-enters the lifecycle at GENERATED/HUMAN_AUTHORED and is revalidated.
 */

export interface QuarantineInput {
  readonly assetId: string;
  readonly assetVersion: string;
  /** Machine reason code only — never child content. */
  readonly reasonCode: string;
  /** Operator / reviewer identity (audit). */
  readonly actor: string;
}

export interface QuarantineRecord extends QuarantineInput {
  readonly at: string;
  readonly regressionCaseId: string;
}

export class QuarantineRegistry {
  readonly #quarantined = new Map<string, QuarantineRecord>();
  readonly #audit: QuarantineRecord[] = [];
  #seq = 0;

  quarantine(
    input: QuarantineInput,
    now: () => string = () => new Date().toISOString(),
  ): QuarantineRecord {
    const regressionCaseId = `RC-${(++this.#seq).toString().padStart(4, '0')}-${input.assetId}`;
    const record: QuarantineRecord = { ...input, at: now(), regressionCaseId };
    this.#quarantined.set(input.assetId, record);
    this.#audit.push(record);
    return record;
  }

  isQuarantined(assetId: string): boolean {
    return this.#quarantined.has(assetId);
  }

  /** Convenience for selection paths (CONT-005/CONT-007). */
  isSelectable(assetId: string): boolean {
    return !this.#quarantined.has(assetId);
  }

  record(assetId: string): QuarantineRecord | null {
    return this.#quarantined.get(assetId) ?? null;
  }

  regressionCaseIds(): readonly string[] {
    return this.#audit.map((r) => r.regressionCaseId);
  }

  /** Append-only audit trail of every quarantine action (CONT-006). */
  auditTrail(): readonly QuarantineRecord[] {
    return [...this.#audit];
  }
}

/**
 * Dual-control gate for disabling a GLOBAL safety control (Security §; TM-09).
 * Turning off a safety control platform-wide requires two distinct human approvers.
 *
 * @throws DomainError REVIEW_REQUIRED — fewer than two distinct approvers.
 */
export function authorizeGlobalSafetyDisable(approverA: string, approverB: string): void {
  if (!approverA || !approverB || approverA === approverB) {
    throw new DomainError(
      'REVIEW_REQUIRED',
      'disabling a global safety control requires two distinct approvers',
    );
  }
}
