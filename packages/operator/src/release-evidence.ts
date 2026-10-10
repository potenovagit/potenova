/**
 * Structured release-evidence repository (OPS-015).
 *
 * Maps requirement IDs to their release artifacts (tests, audits, privacy
 * signoffs, rollback results) so a release gate can produce the links it needs.
 * A gate check reports which required requirement IDs still lack evidence.
 */

export type EvidenceKind = 'test' | 'audit' | 'privacy_signoff' | 'rollback_result';

export interface EvidenceArtifact {
  readonly kind: EvidenceKind;
  readonly ref: string;
}

export class ReleaseEvidenceRepository {
  readonly #byReq = new Map<string, EvidenceArtifact[]>();

  attach(reqId: string, artifact: EvidenceArtifact): void {
    const list = this.#byReq.get(reqId) ?? [];
    list.push(artifact);
    this.#byReq.set(reqId, list);
  }

  artifactsFor(reqId: string): readonly EvidenceArtifact[] {
    return this.#byReq.get(reqId) ?? [];
  }

  /** Requirement IDs (of those required) that still have no attached evidence. */
  missingEvidence(requiredReqIds: readonly string[]): readonly string[] {
    return requiredReqIds.filter((id) => (this.#byReq.get(id)?.length ?? 0) === 0);
  }

  gateReady(requiredReqIds: readonly string[]): boolean {
    return this.missingEvidence(requiredReqIds).length === 0;
  }
}
