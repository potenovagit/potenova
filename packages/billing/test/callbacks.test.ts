import { describe, it, expect } from 'vitest';
import { ProviderCallbackLedger, type ProviderCallback } from '@potenova/billing';

const cb = (over: Partial<ProviderCallback> = {}): ProviderCallback => ({
  channel: 'apple',
  transactionId: 'txn-1',
  familyId: 'fam-1',
  kind: 'grant',
  ...over,
});

describe('idempotent provider callbacks (BILL-004/010; AT-42)', () => {
  it('AT-42: a duplicate callback cannot create a second grant', () => {
    const ledger = new ProviderCallbackLedger();
    expect(ledger.apply(cb())).toEqual({
      applied: true,
      duplicate: false,
      learnerHistoryRewritten: false,
    });
    expect(ledger.apply(cb())).toEqual({
      applied: false,
      duplicate: true,
      learnerHistoryRewritten: false,
    });
    expect(ledger.processedCount()).toBe(1);
  });

  it('distinct channels/transactions are independent (one family entitlement)', () => {
    const ledger = new ProviderCallbackLedger();
    ledger.apply(cb({ channel: 'apple', transactionId: 't1' }));
    ledger.apply(cb({ channel: 'web', transactionId: 't1' }));
    expect(ledger.processedCount()).toBe(2);
  });

  it('BILL-010: a refund never rewrites learner history', () => {
    const ledger = new ProviderCallbackLedger();
    expect(ledger.apply(cb({ kind: 'refund', transactionId: 'r1' })).learnerHistoryRewritten).toBe(
      false,
    );
  });
});
