/**
 * Operator / observability taxonomy (WP-13).
 *
 * Containment capability surfaces (SAFE-012), capability-level degradation ladder
 * (OPS-002), the controls that must FAIL CLOSED, and the incident streams
 * (OPS-004/008). Numeric alert thresholds are caller-supplied / EVIDENCE REQUIRED.
 */

/** Surfaces a kill switch can contain, without an app redeploy (SAFE-012/OPS-007). */
export const CONTAINABLE_CAPABILITIES = [
  'content_generation',
  'free_form_tutor',
  'voice',
  'vision_ocr',
  'model_route',
] as const;
export type ContainableCapability = (typeof CONTAINABLE_CAPABILITIES)[number];

/** Capability-level degradation ladder (OPS-002). */
export const DEGRADATION_LEVELS = [
  'normal',
  'approved_fallback',
  'limited_safe_mode',
  'unavailable',
] as const;
export type DegradationLevel = (typeof DEGRADATION_LEVELS)[number];

/** Controls that fail closed — never degrade to a permissive mode (OPS-002). */
export const FAIL_CLOSED_CONTROLS = ['safety', 'privacy', 'identity', 'residency'] as const;
export type FailClosedControl = (typeof FAIL_CLOSED_CONTROLS)[number];

/** Unified incident streams (OPS-004/008). */
export const INCIDENT_STREAMS = [
  'technical',
  'educational',
  'ai',
  'child_safety',
  'privacy',
  'security',
] as const;
export type IncidentStream = (typeof INCIDENT_STREAMS)[number];

export const INCIDENT_SEVERITY = ['sev1', 'sev2', 'sev3', 'sev4'] as const;
export type IncidentSeverity = (typeof INCIDENT_SEVERITY)[number];
