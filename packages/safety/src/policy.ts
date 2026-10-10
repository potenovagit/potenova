/**
 * Safety / privacy policy taxonomy (WP-11).
 *
 * Data sensitivity classes (SEC-001), safety severity, the tamper-resistant audit
 * event shape (SEC-003; SAFE-017), and the actions that require dual authorization
 * (SEC-003). Numeric values (e.g. elevation TTLs) are supplied by callers and
 * remain EVIDENCE REQUIRED where the spec defers them.
 */

/** SEC-001 data classification. */
export const SENSITIVITY_CLASSES = [
  'public',
  'internal',
  'confidential',
  'highly_sensitive_child_data',
] as const;
export type SensitivityClass = (typeof SENSITIVITY_CLASSES)[number];

/** Observed-risk severity — never a clinical/medical label (SAFE-008). */
export const SAFETY_SEVERITY = ['none', 'low', 'elevated', 'high', 'critical'] as const;
export type SafetySeverity = (typeof SAFETY_SEVERITY)[number];

/** Highest-risk actions that require two distinct approvers (SEC-003). */
export const DUAL_AUTH_ACTIONS = [
  'bulk_child_data_export',
  'disable_critical_safety_control',
] as const;
export type DualAuthAction = (typeof DUAL_AUTH_ACTIONS)[number];

/**
 * A tamper-resistant audit event (SAFE-017): approver, reason, object, action,
 * outcome and expiry — minimized of sensitive content (SEC-003).
 */
export interface AuditEvent {
  readonly approver: string;
  readonly reason: string;
  readonly object: string;
  readonly action: string;
  readonly outcome: 'GRANTED' | 'DENIED' | 'EXECUTED';
  readonly expiry: string | null;
  readonly at: string;
}
