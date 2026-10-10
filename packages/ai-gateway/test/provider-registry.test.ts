import { describe, it, expect } from 'vitest';
import {
  assessProviderResidency,
  isProviderApprovedForChildData,
  CANDIDATE_PROVIDERS,
  type ProviderDescriptor,
} from '@potenova/ai-gateway';

const d = (over: Partial<ProviderDescriptor> = {}): ProviderDescriptor => ({
  id: 'p',
  vendor: 'azure_openai',
  region: 'ca-central',
  trainingDisabled: true,
  modalities: ['text'],
  status: 'candidate',
  ...over,
});

describe('ER-16 residency proof-of-concept (ADR-0005)', () => {
  it('admits a Canadian, training-disabled provider for child data', () => {
    expect(assessProviderResidency(d())).toEqual({ admissibleForChildData: true, reasons: [] });
  });

  it('rejects a non-Canadian region', () => {
    const r = assessProviderResidency(d({ region: 'us-east-1' }));
    expect(r.admissibleForChildData).toBe(false);
    expect(r.reasons).toContain('REGION_NOT_CANADIAN');
  });

  it('rejects a provider whose training is not disabled (PRIV-003)', () => {
    expect(assessProviderResidency(d({ trainingDisabled: false })).reasons).toContain(
      'TRAINING_NOT_DISABLED',
    );
  });

  it('a candidate is never approved for child data until confirmed (ER-16 owner action)', () => {
    // every seeded candidate is residency-admissible in intent, but not yet approved
    for (const p of CANDIDATE_PROVIDERS) {
      expect(assessProviderResidency(p).admissibleForChildData).toBe(true);
      expect(isProviderApprovedForChildData(p)).toBe(false); // status is 'candidate'
    }
    // only an explicitly confirmed descriptor passes
    expect(isProviderApprovedForChildData(d({ status: 'approved' }))).toBe(true);
  });
});
