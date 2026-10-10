import type { DegradationLevel, FailClosedControl } from './policy';

/**
 * Capability-level graceful degradation (OPS-002/009; AT-38/39).
 *
 * The ladder is normal → approved_fallback → limited_safe_mode → unavailable. A
 * fail-closed control (safety, privacy, identity, residency) that is unhealthy
 * jumps straight to `unavailable` — it never degrades to a more permissive mode.
 * Regional degradation never selects a region not approved for child data
 * (OPS-009), which is enforced upstream by the residency gate.
 */

export interface HealthSignals {
  /** Unhealthy fail-closed controls (any present → unavailable). */
  readonly failedControls: readonly FailClosedControl[];
  /** Primary model/provider unavailable (→ fallback if an approved one exists). */
  readonly primaryDown: boolean;
  readonly approvedFallbackAvailable: boolean;
  /** Validation layer unavailable (→ limited safe mode on prevalidated content). */
  readonly validationDown: boolean;
}

export function degradeDecision(signals: HealthSignals): DegradationLevel {
  // Fail-closed controls win first — never a permissive degrade (OPS-002).
  if (signals.failedControls.length > 0) return 'unavailable';

  // Safety validator down → no unvalidated generation; prevalidated safe mode (AT-39).
  if (signals.validationDown) return 'limited_safe_mode';

  // Primary model/provider down → approved fallback, else stop (AT-38).
  if (signals.primaryDown) {
    return signals.approvedFallbackAvailable ? 'approved_fallback' : 'unavailable';
  }

  return 'normal';
}
