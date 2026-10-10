import { describe, it, expect } from 'vitest';
import { confirmUploadFact, uploadFactsForPlanning, type ParentUpload } from '@potenova/parent';
import type { ExtractedFact } from '@potenova/learner-ux';
import { isDomainError } from '@potenova/contracts';

const fact = (id: string): ExtractedFact => ({
  factId: id,
  label: 'Grade 4 math',
  value: 'B',
  recognitionConfidence: 0.6,
  status: 'provisional',
  confirmedBy: null,
});

const upload: ParentUpload = {
  uploadId: 'up-1',
  kind: 'report_card',
  extracted: [fact('f1'), fact('f2')],
};

describe('parent uploads (PAR-006; AT-18)', () => {
  it('AT-18: a guardian confirms an extracted fact before it can reach planning', () => {
    expect(uploadFactsForPlanning(upload.extracted)).toHaveLength(0); // all provisional
    const confirmed = confirmUploadFact(upload, 'f1', 'guardian-1');
    expect(confirmed.status).toBe('confirmed');
    expect(uploadFactsForPlanning([confirmed, upload.extracted[1]!])).toEqual([confirmed]);
  });

  it('rejects confirming a fact that is not on the upload', () => {
    try {
      confirmUploadFact(upload, 'f-nope', 'guardian-1');
      throw new Error('expected NOT_FOUND');
    } catch (e) {
      expect(isDomainError(e) && e.code).toBe('NOT_FOUND');
    }
  });
});
