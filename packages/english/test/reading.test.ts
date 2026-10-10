import { describe, it, expect } from 'vitest';
import {
  attributeReadingEvidence,
  assertNoClinicalLabel,
  type OralReadingObservation,
} from '@potenova/english';
import { isDomainError } from '@potenova/contracts';

const obs = (over: Partial<OralReadingObservation> = {}): OralReadingObservation => ({
  learnerAlias: 'lnr',
  passageId: 'p1',
  signals: {
    substitution: 1,
    omission: 0,
    insertion: 0,
    self_correction: 2,
    pause: 1,
    repetition: 0,
  },
  comprehensionCorrect: true,
  recognitionConfidence: 0.9,
  ttsAssisted: false,
  ...over,
});

describe('oral reading analysis (Product §5; AT-15)', () => {
  it('credits independent decoding when the child reads unaided with good recognition', () => {
    const a = attributeReadingEvidence(obs());
    expect(a.decodingAdmissible).toBe(true);
    expect(a.fluencyAdmissible).toBe(true);
    expect(a.comprehensionAdmissible).toBe(true);
  });

  it('AT-15: under TTS, decoding is NOT credited but comprehension still counts', () => {
    const a = attributeReadingEvidence(obs({ ttsAssisted: true }));
    expect(a.decodingAdmissible).toBe(false);
    expect(a.fluencyAdmissible).toBe(false);
    expect(a.comprehensionAdmissible).toBe(true);
  });

  it('a low-confidence recognition is not trusted for decoding credit', () => {
    expect(attributeReadingEvidence(obs({ recognitionConfidence: 0.5 })).decodingAdmissible).toBe(
      false,
    );
  });

  it('never emits a clinical diagnosis', () => {
    expect(() => assertNoClinicalLabel('observation')).not.toThrow();
    try {
      assertNoClinicalLabel('diagnosis');
      throw new Error('expected POLICY_BLOCKED');
    } catch (e) {
      expect(isDomainError(e) && e.code).toBe('POLICY_BLOCKED');
    }
  });
});
