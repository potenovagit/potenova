import { describe, it, expect } from 'vitest';
import {
  essentialActionsAccessible,
  ESSENTIAL_ACTIONS,
  type ActionAccessibility,
  type A11yProfile,
} from '@potenova/learner-ux';

const profile: A11yProfile = { keyboardOnly: true, captionsOn: true, largeText: true };

const fullyAccessible = (): ActionAccessibility[] =>
  ESSENTIAL_ACTIONS.map((action) => ({
    action,
    keyboardReachable: true,
    hasVisibleLabel: true,
    playsAudio: action === 'replay_audio',
    captioned: true,
  }));

describe('accessibility invariants (AT-47, WCAG 2.2 AA)', () => {
  it('passes when every essential action is reachable, labelled and captioned', () => {
    expect(essentialActionsAccessible(fullyAccessible(), profile).ok).toBe(true);
  });

  it('fails when an essential action is not keyboard-reachable', () => {
    const actions = fullyAccessible().map((a) =>
      a.action === 'submit' ? { ...a, keyboardReachable: false } : a,
    );
    const r = essentialActionsAccessible(actions, profile);
    expect(r.ok).toBe(false);
    expect(r.failing).toContain('submit:not-keyboard-reachable');
  });

  it('fails when an audio action has no caption', () => {
    const actions = fullyAccessible().map((a) =>
      a.action === 'replay_audio' ? { ...a, captioned: false } : a,
    );
    expect(essentialActionsAccessible(actions, profile).failing).toContain(
      'replay_audio:audio-without-caption',
    );
  });

  it('flags a missing essential action', () => {
    const actions = fullyAccessible().filter((a) => a.action !== 'stop');
    expect(essentialActionsAccessible(actions, profile).failing).toContain('stop:missing');
  });
});
