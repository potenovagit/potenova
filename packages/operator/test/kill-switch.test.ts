import { describe, it, expect } from 'vitest';
import { KillSwitchRegistry } from '@potenova/operator';

describe('containment kill switches (SAFE-012; OPS-003/007)', () => {
  it('disables a capability immediately and records an audit event', () => {
    const ks = new KillSwitchRegistry();
    expect(ks.isActive('free_form_tutor')).toBe(true);
    const ev = ks.disable('free_form_tutor', 'op-1', 'jailbreak spike', '2026-10-10T00:00:00Z');
    expect(ks.isActive('free_form_tutor')).toBe(false);
    expect(ev.action).toBe('kill_switch_disable');
    expect(ev.object).toBe('free_form_tutor');
    expect(ks.auditTrail()).toHaveLength(1);
  });

  it('re-enables after containment', () => {
    const ks = new KillSwitchRegistry();
    ks.disable('voice', 'op-1', 'x', 't');
    ks.enable('voice', 'op-1', 'resolved', 't2');
    expect(ks.isActive('voice')).toBe(true);
    expect(ks.auditTrail()).toHaveLength(2);
  });
});
