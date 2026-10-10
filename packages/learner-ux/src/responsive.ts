import type { AgeBand } from '@potenova/identity';
import type { UxPolicy } from './policy';

/**
 * Age-band responsive layout profile (WP-08; AT-47). Pure mapping from a band to
 * the presentation parameters a web or React Native shell binds to. Younger bands
 * get larger targets, larger text, fewer items per screen and icon-led navigation
 * with read-aloud on by default.
 */
export interface LayoutProfile {
  readonly ageBand: AgeBand;
  readonly minTapTargetPx: number;
  readonly textScale: number;
  readonly maxItemsPerScreen: number;
  readonly readAloudDefault: boolean;
  /** Primary band leads with icons over text labels. */
  readonly iconLed: boolean;
}

export function layoutProfileFor(ageBand: AgeBand, policy: UxPolicy): LayoutProfile {
  return {
    ageBand,
    minTapTargetPx: policy.minTapTargetPxByBand[ageBand],
    textScale: policy.baseTextScaleByBand[ageBand],
    maxItemsPerScreen: policy.maxItemsPerScreenByBand[ageBand],
    readAloudDefault: policy.readAloudDefaultByBand[ageBand],
    iconLed: ageBand === 'primary',
  };
}
