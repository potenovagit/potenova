import { describe, it, expect } from 'vitest';
import {
  assessPia,
  assertPiaReadyForBeta,
  type PiaInventory,
  type PiaEntry,
} from '@potenova/safety';
import { isDomainError } from '@potenova/contracts';

const entry = (over: Partial<PiaEntry> = {}): PiaEntry => ({
  dataElement: 'mastery_evidence',
  category: 'learning',
  purpose: 'learning progression',
  legalBasis: 'parental consent',
  sensitivity: 'highly_sensitive_child_data',
  retention: 'per retention schedule',
  subprocessor: null,
  ...over,
});

describe('PIA readiness for beta gate (GOV-004)', () => {
  it('is ready only when complete AND signed', () => {
    const signed: PiaInventory = { version: 'pia-1', entries: [entry()], signedOffBy: 'dpo-owner' };
    expect(assessPia(signed).ready).toBe(true);
    expect(() => assertPiaReadyForBeta(signed)).not.toThrow();
  });

  it('blocks the beta gate when unsigned', () => {
    const unsigned: PiaInventory = { version: 'pia-1', entries: [entry()], signedOffBy: null };
    expect(assessPia(unsigned).ready).toBe(false);
    try {
      assertPiaReadyForBeta(unsigned);
      throw new Error('expected REVIEW_REQUIRED');
    } catch (e) {
      expect(isDomainError(e) && e.code).toBe('REVIEW_REQUIRED');
    }
  });

  it('flags an incomplete data flow', () => {
    const incomplete: PiaInventory = {
      version: 'pia-1',
      entries: [entry({ dataElement: 'voice_derived', purpose: '' })],
      signedOffBy: 'dpo-owner',
    };
    const r = assessPia(incomplete);
    expect(r.ready).toBe(false);
    expect(r.incompleteElements).toContain('voice_derived');
  });
});
