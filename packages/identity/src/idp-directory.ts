import { createHash } from 'node:crypto';

/**
 * Guardian ↔ IdP-subject directory (ADR-0008, ADR-0035).
 *
 * The managed IdP (Microsoft Entra External ID) owns guardian credentials and
 * issues a stable, opaque `subject` per guardian. Potenova never stores the
 * credential, and does not store the raw subject either — it stores a HASH of it
 * as the key in a persisted directory (`idp_directory`) that maps to Potenova's
 * own family/guardian ids, which is where all authorization lives.
 *
 * Children NEVER get an IdP subject — they use a device-bound
 * `ChildSessionCredential` — so this directory is guardian-only by construction.
 *
 * `hashIdpSubject` is the single place the subject is reduced to its storage key:
 * a SHA-256 hex digest, so the opaque IdP identifier is never persisted in the
 * clear and cannot be recovered from the directory.
 */
export function hashIdpSubject(idpSubject: string): string {
  const s = idpSubject.trim();
  if (!s) throw new Error('idp subject is required');
  return createHash('sha256').update(s).digest('hex');
}
