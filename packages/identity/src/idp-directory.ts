/**
 * Guardian ↔ IdP-subject directory (ADR-0008).
 *
 * The managed IdP (Microsoft Entra External ID) owns guardian credentials and
 * issues a stable, opaque `subject` per guardian. Potenova never stores the
 * credential; it maps that subject to its OWN family/guardian identifiers, which
 * is where all authorization lives. This module is that mapping.
 *
 * Children NEVER get an IdP subject — they use a device-bound
 * `ChildSessionCredential` — so this directory is guardian-only by construction.
 *
 * Scaffold form: the mapping is a deterministic, stable derivation of Potenova
 * ids from the subject (one guardian owns one family). The production directory
 * replaces this with a persisted subject→guardian row set behind the same
 * function signature; callers never change.
 */

/** FNV-1a (32-bit) hex of a string — a small, stable, dependency-free digest. */
function stableDigest(input: string): string {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export interface GuardianRef {
  readonly familyId: string;
  readonly guardianId: string;
}

/**
 * Resolve the Potenova family/guardian ids for a verified IdP subject. Pure and
 * stable: the same subject always yields the same ids, so a returning guardian
 * maps to their existing family and a first-time guardian maps to ids the caller
 * then provisions. The subject itself is never stored in these ids (it is hashed),
 * so the opaque IdP identifier does not leak into Potenova's id space.
 *
 * @throws Error when the subject is empty — a verified subject is required.
 */
export function guardianRefForSubject(idpSubject: string): GuardianRef {
  const s = idpSubject.trim();
  if (!s) throw new Error('idp subject is required');
  const d = stableDigest(s);
  return { familyId: `fam-idp-${d}`, guardianId: `gdn-idp-${d}` };
}
