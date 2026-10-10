import { type ErrorCode, DomainError, isDomainError, isApprovedRegion } from '@potenova/contracts';
import { routeModel, type RouteRequest } from '@potenova/domain-core';
import type { ModelRegistry } from './registry';

/**
 * AI gateway routing (WP-04).
 * Source: AI-002/003/004; S-10 (fallback sequence); TM-21/25/47; AT-37/38/55; NFR-02.
 *
 * Fail-closed: every route passes the domain-core gate (residency → approved →
 * age/subject/capability envelope → provider training disabled for child data)
 * BEFORE any provider call. On failure it tries an approved, in-region fallback;
 * if none, it returns BLOCK (safe stop). A non-Canadian processing region is an
 * immediate BLOCK — never crossed by a fallback. Cost never enters this decision.
 */

export interface RouteNeed {
  readonly modelId: string;
  readonly processingRegion: string;
  readonly ageBand: string;
  readonly subject: string;
  readonly capability: string;
  readonly childContext: boolean;
}

export type RouteOutcome =
  | { readonly kind: 'ROUTE'; readonly modelId: string; readonly processingRegion: string }
  | { readonly kind: 'FALLBACK'; readonly modelId: string; readonly processingRegion: string }
  | { readonly kind: 'BLOCK'; readonly reason: ErrorCode };

export class AIGateway {
  readonly #registry: ModelRegistry;

  constructor(registry: ModelRegistry) {
    this.#registry = registry;
  }

  route(need: RouteNeed, opts?: { availableModelIds?: ReadonlySet<string> }): RouteOutcome {
    const avail = opts?.availableModelIds;
    const isAvail = (id: string): boolean => !avail || avail.has(id);
    const req: RouteRequest = {
      modelId: need.modelId,
      processingRegion: need.processingRegion,
      ageBand: need.ageBand,
      subject: need.subject,
      capability: need.capability,
      childContext: need.childContext,
    };

    // A non-Canadian processing region can never be satisfied or fallen back across.
    if (!isApprovedRegion(need.processingRegion)) {
      return { kind: 'BLOCK', reason: 'REGION_DISALLOWED' };
    }

    let lastCode: ErrorCode = 'DEPENDENCY_UNAVAILABLE';

    // 1. The requested model, if present and available.
    const entry = this.#registry.get(need.modelId);
    if (entry && isAvail(entry.modelId)) {
      try {
        const d = routeModel(entry, req);
        return { kind: 'ROUTE', modelId: d.modelId, processingRegion: d.processingRegion };
      } catch (e) {
        if (isDomainError(e)) lastCode = e.code;
      }
    }

    // 2. Approved, in-region, in-envelope fallback (S-10).
    const fallbacks = this.#registry
      .routable({
        region: need.processingRegion,
        ageBand: need.ageBand,
        subject: need.subject,
        capability: need.capability,
      })
      .filter((c) => isAvail(c.modelId) && c.modelId !== need.modelId);

    for (const c of fallbacks) {
      try {
        const d = routeModel(c, { ...req, modelId: c.modelId });
        return { kind: 'FALLBACK', modelId: d.modelId, processingRegion: d.processingRegion };
      } catch (e) {
        if (isDomainError(e)) lastCode = e.code;
      }
    }

    // 3. Nothing safe to route to → stop (OPS-002 fail-closed).
    return { kind: 'BLOCK', reason: lastCode };
  }

  /**
   * Candidate-model evaluation path (AI-003; S-09; AT-37): a non-APPROVED model
   * may be evaluated ONLY with synthetic/de-identified data, never production
   * child data. Returns an eval route or fails closed.
   *
   * @throws DomainError POLICY_BLOCKED — non-synthetic data requested for a candidate
   */
  routeForEvaluation(
    modelId: string,
    opts: { synthetic: boolean; processingRegion: string },
  ): { readonly modelId: string; readonly processingRegion: string } {
    if (!opts.synthetic) {
      throw new DomainError('POLICY_BLOCKED', 'candidate models may receive synthetic data only');
    }
    if (!isApprovedRegion(opts.processingRegion)) {
      throw new DomainError('REGION_DISALLOWED', 'evaluation must run in an approved region');
    }
    if (!this.#registry.get(modelId)) {
      throw new DomainError('NOT_FOUND', 'model not in registry');
    }
    return { modelId, processingRegion: opts.processingRegion };
  }
}
