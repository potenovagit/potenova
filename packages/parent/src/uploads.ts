import { DomainError } from '@potenova/contracts';
import { confirmFact, factsUsableForPlanning, type ExtractedFact } from '@potenova/learner-ux';

/**
 * Parent uploads: report cards, tests, worksheets, teacher feedback (PAR-006;
 * AT-18). Extraction produces PROVISIONAL facts; a guardian must confirm each
 * before it can become planning evidence. Reuses the WP-08 confirmation guard so
 * the "confirm before planning" invariant is shared, not duplicated.
 */

export const UPLOAD_KINDS = ['report_card', 'test', 'worksheet', 'teacher_feedback'] as const;
export type UploadKind = (typeof UPLOAD_KINDS)[number];

export interface ParentUpload {
  readonly uploadId: string;
  readonly kind: UploadKind;
  readonly extracted: readonly ExtractedFact[];
}

/** A guardian confirms one extracted fact (PAR-006 confirmation gate). */
export function confirmUploadFact(
  upload: ParentUpload,
  factId: string,
  guardianId: string,
): ExtractedFact {
  const fact = upload.extracted.find((f) => f.factId === factId);
  if (!fact) throw new DomainError('NOT_FOUND', 'extracted fact not found on this upload');
  return confirmFact(fact, guardianId);
}

/** Only parent-confirmed facts may flow into planning (AT-18). */
export function uploadFactsForPlanning(facts: readonly ExtractedFact[]): ExtractedFact[] {
  return factsUsableForPlanning(facts);
}
