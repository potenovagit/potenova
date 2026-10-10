/**
 * Zero-advertising / zero-profiling attestation (SAFE-014; AT-58).
 *
 * The child surface must carry no advertising SDK, no third-party behavioural
 * profiling, and no disallowed device identifiers. This scans a declared
 * dependency/SDK manifest and flags any violation so a CI gate can block the
 * build (the real network-beacon scan runs in CI; this is the structural check).
 */

export type SdkCategory = 'advertising' | 'behavioral_analytics' | 'educational' | 'infrastructure';

export interface SdkEntry {
  readonly name: string;
  readonly category: SdkCategory;
}

/** Device identifiers disallowed in a child app (e.g. Android Advertising ID). */
export const DISALLOWED_IDENTIFIERS = ['android_advertising_id', 'idfa', 'idfv_for_ads'] as const;
export type DisallowedIdentifier = (typeof DISALLOWED_IDENTIFIERS)[number];

export interface ChildSurfaceManifest {
  readonly sdks: readonly SdkEntry[];
  readonly identifiersUsed: readonly string[];
}

export interface AdvertisingScanResult {
  readonly ok: boolean;
  readonly violations: readonly string[];
}

export function scanChildSurface(manifest: ChildSurfaceManifest): AdvertisingScanResult {
  const violations: string[] = [];
  for (const sdk of manifest.sdks) {
    if (sdk.category === 'advertising' || sdk.category === 'behavioral_analytics') {
      violations.push(`sdk:${sdk.name}:${sdk.category}`);
    }
  }
  const disallowed = new Set<string>(DISALLOWED_IDENTIFIERS);
  for (const id of manifest.identifiersUsed) {
    if (disallowed.has(id)) violations.push(`identifier:${id}`);
  }
  return { ok: violations.length === 0, violations };
}
