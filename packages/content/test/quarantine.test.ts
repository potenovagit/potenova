import { describe, it, expect } from 'vitest';
import { QuarantineRegistry, authorizeGlobalSafetyDisable } from '@potenova/content';
import { isDomainError } from '@potenova/contracts';

describe('quarantine + human review (CONT-007, AT-49)', () => {
  it('AT-49: quarantine makes an asset non-selectable, auditable, and opens a regression case', () => {
    const q = new QuarantineRegistry();
    const rec = q.quarantine({
      assetId: 'asset-7',
      assetVersion: 'v3',
      reasonCode: 'WRONG_ANSWER_KEY',
      actor: 'operator-1',
    });

    expect(q.isSelectable('asset-7')).toBe(false);
    expect(q.isQuarantined('asset-7')).toBe(true);

    // auditable: version + action captured
    expect(rec.assetVersion).toBe('v3');
    expect(q.auditTrail()).toHaveLength(1);
    expect(q.record('asset-7')?.reasonCode).toBe('WRONG_ANSWER_KEY');

    // regression case created
    expect(rec.regressionCaseId).toMatch(/^RC-\d{4}-asset-7$/);
    expect(q.regressionCaseIds()).toContain(rec.regressionCaseId);
  });

  it('an un-quarantined asset remains selectable', () => {
    const q = new QuarantineRegistry();
    expect(q.isSelectable('asset-unknown')).toBe(true);
  });

  it('disabling a global safety control requires two distinct approvers', () => {
    expect(() => authorizeGlobalSafetyDisable('approver-a', 'approver-b')).not.toThrow();

    for (const [a, b] of [
      ['approver-a', 'approver-a'],
      ['', 'approver-b'],
      ['approver-a', ''],
    ]) {
      try {
        authorizeGlobalSafetyDisable(a, b);
        throw new Error('expected REVIEW_REQUIRED');
      } catch (e) {
        expect(isDomainError(e) && e.code).toBe('REVIEW_REQUIRED');
      }
    }
  });
});
