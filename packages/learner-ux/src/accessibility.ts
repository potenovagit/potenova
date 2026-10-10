/**
 * Accessibility invariants (WP-08; AT-47; ADR-0012 WCAG 2.2 AA).
 *
 * Under any accessibility profile — keyboard-only, captions on, large text — every
 * ESSENTIAL action must remain reachable by keyboard, carry a visible label, and
 * (when it plays audio) provide a caption. The checker returns the failing actions
 * so a build/a11y gate can block a regression.
 */

export const ESSENTIAL_ACTIONS = [
  'submit',
  'request_help',
  'stop',
  'navigate',
  'replay_audio',
] as const;
export type EssentialAction = (typeof ESSENTIAL_ACTIONS)[number];

export interface A11yProfile {
  readonly keyboardOnly: boolean;
  readonly captionsOn: boolean;
  readonly largeText: boolean;
}

export interface ActionAccessibility {
  readonly action: EssentialAction;
  readonly keyboardReachable: boolean;
  readonly hasVisibleLabel: boolean;
  /** Plays audio as part of the action (e.g. replay_audio). */
  readonly playsAudio: boolean;
  readonly captioned: boolean;
}

export interface A11yResult {
  readonly ok: boolean;
  readonly failing: readonly string[];
}

export function essentialActionsAccessible(
  actions: readonly ActionAccessibility[],
  _profile: A11yProfile,
): A11yResult {
  const byAction = new Map(actions.map((a) => [a.action, a]));
  const failing: string[] = [];

  for (const action of ESSENTIAL_ACTIONS) {
    const a = byAction.get(action);
    if (!a) {
      failing.push(`${action}:missing`);
      continue;
    }
    if (!a.keyboardReachable) failing.push(`${action}:not-keyboard-reachable`);
    if (!a.hasVisibleLabel) failing.push(`${action}:no-visible-label`);
    if (a.playsAudio && !a.captioned) failing.push(`${action}:audio-without-caption`);
  }

  return { ok: failing.length === 0, failing };
}
