import { describe, it, expect } from 'vitest';
import { confirmUpgrade, scheduleDowngrade, enterGrace, expireAfterGrace } from '@potenova/billing';

describe('upgrade/downgrade/grace (BILL-008/009; AT-43/44)', () => {
  it('BILL-008: a confirmed upgrade takes effect immediately', () => {
    const r = confirmUpgrade('TRIAL_EXPIRED');
    expect(r.state).toBe('PAID_ACTIVE');
    expect(r.effective).toBe('IMMEDIATE');
    expect(r.evidenceTouched).toBe(false);
  });

  it('AT-43: a downgrade is deferred to the end of the current period, access retained', () => {
    const r = scheduleDowngrade('PAID_ACTIVE');
    expect(r.state).toBe('CANCEL_SCHEDULED');
    expect(r.effective).toBe('END_OF_PERIOD');
  });

  it('AT-44: a failed charge within grace keeps learning active', () => {
    const r = enterGrace('PAID_ACTIVE');
    expect(r.state).toBe('PAST_DUE_GRACE');
  });

  it('grace lapses to PAID_EXPIRED when unrecovered', () => {
    expect(expireAfterGrace('PAST_DUE_GRACE').state).toBe('PAID_EXPIRED');
  });

  it('upgrade is idempotent when already paid-active', () => {
    expect(confirmUpgrade('PAID_ACTIVE').state).toBe('PAID_ACTIVE');
  });
});
