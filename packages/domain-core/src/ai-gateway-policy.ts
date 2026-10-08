import { DomainError, isApprovedRegion } from '@potenova/contracts';

/**
 * AI gateway routing policy (pre-invocation gate).
 *
 * LOCKED invariants (AI-002/AI-003/AI-004; Architecture §4; TM-21/TM-25;
 * AT-37/AT-55; C-13/C-29): the orchestrator may route a child-context request
 * only to a model that is (a) APPROVED in the registry, (b) within its approved
 * region allowlist AND the requested processing region is Canada-resident,
 * (c) within its approved age-band / subject / capability envelope, and (d) has
 * provider-side training disabled. Otherwise: fail closed to safe fallback /
 * unavailable. Cost never overrides these gates.
 */

export type ModelStatus =
  | 'PROPOSED'
  | 'SYNTHETIC_TESTING'
  | 'EVALUATED'
  | 'APPROVED'
  | 'RESTRICTED'
  | 'DEPRECATED'
  | 'DISABLED';

export interface ModelRegistryEntry {
  readonly modelId: string;
  readonly status: ModelStatus;
  readonly allowedRegions: readonly string[];
  readonly ageBands: readonly string[];
  readonly subjects: readonly string[];
  readonly capabilities: readonly string[];
  /** Provider-side training on our data must be contractually/technically off. */
  readonly trainingDisabled: boolean;
}

export interface RouteRequest {
  readonly modelId: string;
  readonly processingRegion: string;
  readonly ageBand: string;
  readonly subject: string;
  readonly capability: string;
  /** True when the request carries production child context. */
  readonly childContext: boolean;
}

export interface RouteDecision {
  readonly modelId: string;
  readonly processingRegion: string;
  readonly reason: 'APPROVED_ROUTE';
}

/**
 * @throws DomainError REGION_DISALLOWED — processing region not Canada-resident,
 *                                         or not in the model's allowlist
 * @throws DomainError POLICY_BLOCKED    — model not APPROVED, outside envelope,
 *                                         or training not disabled for child data
 */
export function routeModel(entry: ModelRegistryEntry, req: RouteRequest): RouteDecision {
  // (a) Residency first — fail-closed before any capability consideration.
  if (!isApprovedRegion(req.processingRegion)) {
    throw new DomainError('REGION_DISALLOWED', 'processing region is not Canada-resident');
  }
  if (!entry.allowedRegions.includes(req.processingRegion)) {
    throw new DomainError('REGION_DISALLOWED', 'model not approved for requested region');
  }
  // (b) Registry approval status.
  if (entry.status !== 'APPROVED') {
    throw new DomainError('POLICY_BLOCKED', 'model is not approved for routing');
  }
  if (entry.modelId !== req.modelId) {
    throw new DomainError('POLICY_BLOCKED', 'model identity mismatch');
  }
  // (c) Capability envelope.
  if (!entry.ageBands.includes(req.ageBand)) {
    throw new DomainError('POLICY_BLOCKED', 'age band outside approved envelope');
  }
  if (!entry.subjects.includes(req.subject)) {
    throw new DomainError('POLICY_BLOCKED', 'subject outside approved envelope');
  }
  if (!entry.capabilities.includes(req.capability)) {
    throw new DomainError('POLICY_BLOCKED', 'capability outside approved envelope');
  }
  // (d) No general-purpose training on child data (PRIV-003, TM-20).
  if (req.childContext && !entry.trainingDisabled) {
    throw new DomainError('POLICY_BLOCKED', 'provider training must be disabled for child data');
  }
  return {
    modelId: entry.modelId,
    processingRegion: req.processingRegion,
    reason: 'APPROVED_ROUTE',
  };
}
