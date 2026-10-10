import { describe, it, expect } from 'vitest';
import { degradeDecision, type HealthSignals } from '@potenova/operator';

const base = (over: Partial<HealthSignals> = {}): HealthSignals => ({
  failedControls: [],
  primaryDown: false,
  approvedFallbackAvailable: true,
  validationDown: false,
  ...over,
});

describe('graceful degradation (OPS-002/009; AT-38/39)', () => {
  it('normal when everything is healthy', () => {
    expect(degradeDecision(base())).toBe('normal');
  });

  it('OPS-002: a failed fail-closed control goes straight to unavailable', () => {
    expect(degradeDecision(base({ failedControls: ['residency'] }))).toBe('unavailable');
    expect(degradeDecision(base({ failedControls: ['safety'], primaryDown: true }))).toBe(
      'unavailable',
    );
  });

  it('AT-39: validation down → limited safe mode (prevalidated only)', () => {
    expect(degradeDecision(base({ validationDown: true }))).toBe('limited_safe_mode');
  });

  it('AT-38: primary down → approved fallback, or stop when none', () => {
    expect(degradeDecision(base({ primaryDown: true, approvedFallbackAvailable: true }))).toBe(
      'approved_fallback',
    );
    expect(degradeDecision(base({ primaryDown: true, approvedFallbackAvailable: false }))).toBe(
      'unavailable',
    );
  });
});
