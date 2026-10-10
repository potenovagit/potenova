import { describe, it, expect } from 'vitest';
import { ModelRegistry, AIGateway, type RouteNeed } from '@potenova/ai-gateway';
import type { ModelRegistryEntry } from '@potenova/domain-core';
import { isDomainError } from '@potenova/contracts';

function entry(id: string, over: Partial<ModelRegistryEntry> = {}): ModelRegistryEntry {
  return {
    modelId: id,
    status: 'APPROVED',
    allowedRegions: ['ca-central', 'ca-east'],
    ageBands: ['primary', 'junior'],
    subjects: ['math'],
    capabilities: ['generate_instruction'],
    trainingDisabled: true,
    ...over,
  };
}

const need = (over: Partial<RouteNeed> = {}): RouteNeed => ({
  modelId: 'approved-1',
  processingRegion: 'ca-central',
  ageBand: 'junior',
  subject: 'math',
  capability: 'generate_instruction',
  childContext: true,
  ...over,
});

function gw(...entries: ModelRegistryEntry[]): AIGateway {
  const r = new ModelRegistry();
  for (const e of entries) r.register(e);
  return new AIGateway(r);
}

describe('AI gateway routing (AI-002/003/004, TM-21/25, AT-37/38/55, NFR-02)', () => {
  it('routes an approved, in-region, in-envelope, training-disabled model', () => {
    const o = gw(entry('approved-1')).route(need());
    expect(o.kind).toBe('ROUTE');
    if (o.kind !== 'BLOCK') expect(o.modelId).toBe('approved-1');
  });

  it('AT-55 / NFR-02: a non-Canadian region is blocked and never fallen back across', () => {
    const o = gw(entry('approved-1')).route(need({ processingRegion: 'us-east-1' }));
    expect(o).toEqual({ kind: 'BLOCK', reason: 'REGION_DISALLOWED' });
  });

  it('AT-37: a candidate model with child context never routes — falls back to an approved model', () => {
    const g = gw(entry('candidate-x', { status: 'SYNTHETIC_TESTING' }), entry('approved-1'));
    const o = g.route(need({ modelId: 'candidate-x' }));
    expect(o.kind).toBe('FALLBACK');
    if (o.kind !== 'BLOCK') expect(o.modelId).toBe('approved-1'); // the candidate is never chosen
  });

  it('AT-37: with no approved alternative, a candidate request is blocked (never routed)', () => {
    const o = gw(entry('candidate-x', { status: 'EVALUATED' })).route(
      need({ modelId: 'candidate-x' }),
    );
    expect(o.kind).toBe('BLOCK');
  });

  it('AT-38: primary model outage falls back to another approved in-region model', () => {
    const g = gw(entry('approved-1'), entry('approved-2'));
    const o = g.route(need(), { availableModelIds: new Set(['approved-2']) }); // approved-1 down
    expect(o.kind).toBe('FALLBACK');
    if (o.kind !== 'BLOCK') expect(o.modelId).toBe('approved-2');
  });

  it('AT-38: total outage stops safely (BLOCK), never an unsafe route', () => {
    const o = gw(entry('approved-1')).route(need(), { availableModelIds: new Set() });
    expect(o.kind).toBe('BLOCK');
  });

  it('refuses child-context routing when provider training is not disabled (PRIV-003/TM-20)', () => {
    const o = gw(entry('approved-1', { trainingDisabled: false })).route(need());
    expect(o.kind).toBe('BLOCK'); // no approved training-disabled model available
  });

  it('AT-37: candidate evaluation requires synthetic data', () => {
    const g = gw(entry('candidate-x', { status: 'SYNTHETIC_TESTING' }));
    try {
      g.routeForEvaluation('candidate-x', { synthetic: false, processingRegion: 'ca-central' });
      throw new Error('expected POLICY_BLOCKED');
    } catch (e) {
      expect(isDomainError(e) && e.code).toBe('POLICY_BLOCKED');
    }
    expect(
      g.routeForEvaluation('candidate-x', { synthetic: true, processingRegion: 'ca-central' }),
    ).toEqual({ modelId: 'candidate-x', processingRegion: 'ca-central' });
  });
});
