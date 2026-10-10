import type { AgeBand } from '@potenova/identity';

/**
 * Learner-UX policy (WP-08) — versioned, DRAFT parameters.
 *
 * ============================================================================
 *  LOCKED (ADR-0012): WCAG 2.2 AA with native-equivalent accessibility is the
 *  qualitative target. The NUMERIC values here (tap sizes, text scale, items per
 *  screen) are DRAFT placeholders — EVIDENCE REQUIRED from usability testing with
 *  each age band before G2. Isolated behind a version string so tuning is a
 *  policy bump, never a logic rewrite.
 *
 *  Age bands (F-08): primary G1-3, junior G4-6, intermediate G7-8.
 * ============================================================================
 */
export interface UxPolicy {
  readonly policyVersion: string;
  readonly minTapTargetPxByBand: Readonly<Record<AgeBand, number>>;
  readonly baseTextScaleByBand: Readonly<Record<AgeBand, number>>;
  readonly maxItemsPerScreenByBand: Readonly<Record<AgeBand, number>>;
  readonly readAloudDefaultByBand: Readonly<Record<AgeBand, boolean>>;
}

export const DRAFT_UX_POLICY: UxPolicy = {
  policyVersion: 'ux-DRAFT-0.1(WCAG-2.2-AA-LOCKED; sizes-UNCALIBRATED)',
  minTapTargetPxByBand: { primary: 64, junior: 48, intermediate: 44 },
  baseTextScaleByBand: { primary: 1.3, junior: 1.15, intermediate: 1.0 },
  maxItemsPerScreenByBand: { primary: 1, junior: 3, intermediate: 5 },
  readAloudDefaultByBand: { primary: true, junior: false, intermediate: false },
};
