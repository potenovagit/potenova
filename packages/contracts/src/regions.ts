/**
 * Data-residency region model.
 * Source: Master §4 ("Canadian processing residency across AI/voice/vision/
 * analytics/logs/backup/support"); trust boundary B9; TM-21; AT-55.
 *
 * Residency is a FAIL-CLOSED, LOCKED control: a call whose processing region is
 * not on the approved allowlist must be refused BEFORE any provider invocation.
 */
export const APPROVED_REGIONS = [
  'ca-central', // primary (e.g. Toronto / Montreal)
  'ca-east', // disaster recovery (second Canadian region)
] as const;

export type Region = (typeof APPROVED_REGIONS)[number];

export function isApprovedRegion(region: string): region is Region {
  return (APPROVED_REGIONS as readonly string[]).includes(region);
}

export interface RegionContext {
  /** Region in which processing is requested to occur. */
  readonly processingRegion: string;
  /** Market/data-subject region of the family. MVP: Ontario → ca. */
  readonly marketRegion: string;
}
