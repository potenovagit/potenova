import { describe, it, expect } from 'vitest';
import {
  openDsr,
  advanceDsr,
  finalizeDeletion,
  revokeModalityConsent,
  type DataSubjectRequest,
  type DeletionTarget,
} from '@potenova/safety';
import { isDomainError } from '@potenova/contracts';

const toVerifying = (kind: 'export' | 'deletion'): DataSubjectRequest => {
  let r = openDsr('dsr-1', kind);
  for (const s of ['AUTHENTICATING', 'SCOPED', 'EXECUTING', 'VERIFYING'] as const) {
    r = advanceDsr(r, s);
  }
  return r;
};

describe('data-subject request (§3.9; PRIV-005; AT-34/35)', () => {
  it('AT-35: completes only when every target is reconciled or documented', () => {
    const targets: DeletionTarget[] = [
      { target: 'primary', reconciled: true, documentedException: false },
      { target: 'backup', reconciled: false, documentedException: true },
    ];
    expect(finalizeDeletion(toVerifying('deletion'), targets).state).toBe('COMPLETE');
  });

  it('AT-35: an unresolved, undocumented target goes to EXCEPTION_REVIEW, not "complete"', () => {
    const targets: DeletionTarget[] = [
      { target: 'processor', reconciled: false, documentedException: false },
    ];
    expect(finalizeDeletion(toVerifying('deletion'), targets).state).toBe('EXCEPTION_REVIEW');
  });

  it('rejects an illegal state jump', () => {
    try {
      advanceDsr(openDsr('dsr-2', 'export'), 'COMPLETE');
      throw new Error('expected POLICY_BLOCKED');
    } catch (e) {
      expect(isDomainError(e) && e.code).toBe('POLICY_BLOCKED');
    }
  });

  it('AT-34: revoking an optional modality stops it but core learning continues', () => {
    const r = revokeModalityConsent('voice');
    expect(r.stoppedModality).toBe('voice');
    expect(r.coreLearningContinues).toBe(true);
  });
});
