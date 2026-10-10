import { describe, it, expect } from 'vitest';
import {
  ModelRegistry,
  AIGateway,
  CostLedger,
  TestDoubleProvider,
  assertCostPayloadClean,
  type CostEvent,
} from '@potenova/ai-gateway';
import type { ModelRegistryEntry } from '@potenova/domain-core';
import { isDomainError } from '@potenova/contracts';

const approved: ModelRegistryEntry = {
  modelId: 'approved-1',
  status: 'APPROVED',
  allowedRegions: ['ca-central'],
  ageBands: ['junior'],
  subjects: ['math'],
  capabilities: ['generate_instruction'],
  trainingDisabled: true,
};

const costEvent = (sessionId: string, est: number): CostEvent => ({
  eventId: `c-${sessionId}-${est}`,
  familyAlias: 'fam-alias',
  learnerAlias: 'lnr-alias',
  sessionId,
  capability: 'generate_instruction',
  provider: 'test-double',
  model: 'approved-1',
  units: 10,
  estimatedCost: est,
});

describe('cost envelopes + synthetic harness (AI-006, C-32, TM-24, AT-40)', () => {
  it('C-32/TM-24: cost payloads carrying raw child content are rejected', () => {
    try {
      assertCostPayloadClean({ sessionId: 's1', transcript: 'the child said…' });
      throw new Error('expected POLICY_BLOCKED');
    } catch (e) {
      expect(isDomainError(e) && e.code).toBe('POLICY_BLOCKED');
    }
  });

  it('AT-40: exceeding the DRAFT budget flags an anomaly but never cuts the child off', () => {
    const ledger = new CostLedger(1.0);
    expect(ledger.record(costEvent('s1', 0.6)).overBudget).toBe(false);
    const second = ledger.record(costEvent('s1', 0.6));
    expect(second.overBudget).toBe(true); // anomaly flagged

    // routing is NEVER blocked because of cost — the gateway does not consult the budget
    const reg = new ModelRegistry();
    reg.register(approved);
    const gw = new AIGateway(reg);
    const outcome = gw.route({
      modelId: 'approved-1',
      processingRegion: 'ca-central',
      ageBand: 'junior',
      subject: 'math',
      capability: 'generate_instruction',
      childContext: true,
    });
    expect(outcome.kind).toBe('ROUTE'); // over-budget state did not force a BLOCK
  });

  it('synthetic harness runs end-to-end on the test double (no real model)', () => {
    const reg = new ModelRegistry();
    reg.register({ ...approved, status: 'SYNTHETIC_TESTING', modelId: 'candidate-x' });
    const gw = new AIGateway(reg);
    const route = gw.routeForEvaluation('candidate-x', {
      synthetic: true,
      processingRegion: 'ca-central',
    });

    const provider = new TestDoubleProvider('candidate-x', 'ca-central', 12);
    const result = provider.invoke({
      capability: 'generate_instruction',
      ageBand: 'junior',
      subject: 'math',
      synthetic: true,
    });
    expect(result.ok).toBe(true);

    const ledger = new CostLedger();
    const rec = ledger.record({
      eventId: 'c1',
      familyAlias: 'synthetic',
      learnerAlias: 'synthetic',
      sessionId: 'eval-1',
      capability: 'generate_instruction',
      provider: route.modelId,
      model: route.modelId,
      units: result.units,
      estimatedCost: 0.12,
    });
    expect(rec.overBudget).toBe(false);
    expect(ledger.events()).toHaveLength(1);
  });
});
