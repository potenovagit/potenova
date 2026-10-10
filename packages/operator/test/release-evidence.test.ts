import { describe, it, expect } from 'vitest';
import { ReleaseEvidenceRepository } from '@potenova/operator';

describe('release evidence repository (OPS-015)', () => {
  it('reports which required requirement IDs still lack evidence', () => {
    const repo = new ReleaseEvidenceRepository();
    repo.attach('SAFE-010', { kind: 'test', ref: 'RTEST-SAFE-010/run-1' });
    repo.attach('SAFE-010', { kind: 'audit', ref: 'audit/sink-1' });

    expect(repo.artifactsFor('SAFE-010')).toHaveLength(2);
    expect(repo.missingEvidence(['SAFE-010', 'SEC-005'])).toEqual(['SEC-005']);
    expect(repo.gateReady(['SAFE-010'])).toBe(true);
    expect(repo.gateReady(['SAFE-010', 'SEC-005'])).toBe(false);
  });
});
