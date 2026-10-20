import { DomainError } from '@potenova/contracts';
import type { ModelRegistryEntry, ModelStatus } from '@potenova/domain-core';

/**
 * Model registry (WP-04).
 * Source: AI-002/003; ModelRegistryEntry state machine 3.5; S-09.
 *
 * Holds the approved-model allowlist and enforces the lifecycle
 * PROPOSED → SYNTHETIC_TESTING → EVALUATED → APPROVED → RESTRICTED/DEPRECATED/
 * DISABLED. Only APPROVED entries are routable for production; a new version is
 * a new candidate, never a silent replacement.
 */

const ROUTABLE: ModelStatus = 'APPROVED';

export class ModelRegistry {
  readonly #entries = new Map<string, ModelRegistryEntry>();

  register(entry: ModelRegistryEntry): void {
    this.#entries.set(entry.modelId, Object.freeze({ ...entry }));
  }

  setStatus(modelId: string, status: ModelStatus): void {
    const e = this.#entries.get(modelId);
    if (!e) throw new DomainError('NOT_FOUND', 'model not in registry');
    this.#entries.set(modelId, Object.freeze({ ...e, status }));
  }

  get(modelId: string): ModelRegistryEntry | undefined {
    return this.#entries.get(modelId);
  }

  /** Every registered model, for a read-only routing/approval view. Never used
   *  to make a routing decision — that stays `routable()`, which gates on status,
   *  region and envelope. */
  list(): readonly ModelRegistryEntry[] {
    return [...this.#entries.values()];
  }

  isApprovedForProduction(modelId: string): boolean {
    return this.#entries.get(modelId)?.status === ROUTABLE;
  }

  /** Approved, in-region, in-envelope candidates for a given routing need. */
  routable(opts: {
    region: string;
    ageBand: string;
    subject: string;
    capability: string;
  }): readonly ModelRegistryEntry[] {
    return [...this.#entries.values()].filter(
      (e) =>
        e.status === ROUTABLE &&
        e.allowedRegions.includes(opts.region) &&
        e.ageBands.includes(opts.ageBand) &&
        e.subjects.includes(opts.subject) &&
        e.capabilities.includes(opts.capability),
    );
  }
}
