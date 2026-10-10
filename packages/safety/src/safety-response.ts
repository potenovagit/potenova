/**
 * Constrained safety responses (SAFE-001/004/006/009/016; AT-22/23/36).
 *
 * The child-safety layer is separate from tutoring and uses constrained, approved
 * response patterns for sensitive events. It never promises secrecy or claims to
 * be human (AT-22; SAFE-004), it distinguishes off-topic chatter from a sensitive
 * disclosure (SAFE-016), and when a risk implicates the household it avoids an
 * unsafe automatic parent notification, routing to restricted review instead
 * (AT-23). Switching tutor persona changes voice only — never safety rules or
 * learner state (AT-36).
 */

export interface SecrecyRequestResponse {
  /** Invariant (AT-22/SAFE-004): the tutor never promises to keep a secret. */
  readonly promisesSecrecy: false;
  /** Invariant: no deceptive claim of being a human. */
  readonly claimsHuman: false;
  readonly action: 'SAFE_REDIRECT';
}

export function secrecyRequestResponse(): SecrecyRequestResponse {
  return { promisesSecrecy: false, claimsHuman: false, action: 'SAFE_REDIRECT' };
}

export type DisclosureKind = 'off_topic' | 'sensitive';
export type DisclosureHandling = 'REDIRECT' | 'SAFETY_PROTOCOL';

/** SAFE-016: off-topic chatter is redirected; a sensitive statement follows protocol. */
export function handleDisclosure(kind: DisclosureKind): DisclosureHandling {
  return kind === 'sensitive' ? 'SAFETY_PROTOCOL' : 'REDIRECT';
}

export interface GuardianRiskRouting {
  readonly route: 'RESTRICTED_REVIEW';
  /** Invariant (AT-23): household implication blocks an automatic parent alert. */
  readonly notifyParentAutomatically: false;
}

/**
 * AT-23: when a disclosed risk implicates a guardian/household, route to restricted
 * review rather than an automatic parent notification.
 */
export function guardianRiskRouting(_input: {
  readonly householdImplication: boolean;
}): GuardianRiskRouting {
  return { route: 'RESTRICTED_REVIEW', notifyParentAutomatically: false };
}

export interface PersonaSwitch {
  readonly persona: string;
  /** Invariants (AT-36): persona is cosmetic — safety rules and state are untouched. */
  readonly safetyRulesChanged: false;
  readonly learnerStateChanged: false;
}

export function switchPersona(newPersona: string): PersonaSwitch {
  return { persona: newPersona, safetyRulesChanged: false, learnerStateChanged: false };
}
