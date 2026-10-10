import { DomainError } from '@potenova/contracts';
import type { ValidationVerdict } from '@potenova/domain-core';

/**
 * Independent educational + safety validation (ADR-0006; AI-001; CONT-001..003;
 * TM-09/TM-10; AT-20/AT-21/AT-39).
 *
 * Non-negotiables encoded here:
 *  - The validator is INDEPENDENT of the generator. Same identity => POLICY_BLOCKED
 *    (a generator cannot bless its own output — TM-10).
 *  - FAIL on a wrong deterministic Math key (AT-20) or on an unsafe/off-topic
 *    conversational turn (AT-21).
 *  - If the safety validator is UNAVAILABLE, the verdict is UNAVAILABLE and the
 *    caller must fail closed — never deliver (AT-39).
 *  - A PASS is accompanied by a signed, referenceable record; the child-facing
 *    content-gate refuses a PASS that has no signed record.
 */

export interface SafetySignal {
  /** False when the safety validator could not run (outage) — forces fail-closed. */
  readonly available: boolean;
  /** true = safe, false = unsafe, null = inconclusive. */
  readonly pass: boolean | null;
}

export interface ValidationInput {
  readonly candidateId: string;
  /** Who produced the candidate (model id / author id). */
  readonly generatorId: string;
  /** Who is validating it — MUST differ from generatorId. */
  readonly validatorId: string;
  readonly validatorVersion: string;
  /** Deterministic Math oracle outcome (see math-check); ran=false when N/A. */
  readonly math: { readonly ran: boolean; readonly correct: boolean | null };
  /** Independent safety screen. */
  readonly safety: SafetySignal;
  /** On-topic (Math/English coaching only) — null = inconclusive. */
  readonly onTopic: boolean | null;
}

export interface ValidationRecord {
  readonly candidateId: string;
  readonly validatorId: string;
  readonly validatorVersion: string;
  readonly verdict: ValidationVerdict;
  /** Machine reason codes only — never child content. */
  readonly reasonCodes: readonly string[];
  readonly signedAt: string;
}

/**
 * Run independent validation and return a signed record.
 *
 * @throws DomainError POLICY_BLOCKED — generator and validator are the same identity.
 */
export function validateCandidate(
  input: ValidationInput,
  now: () => string = () => new Date().toISOString(),
): ValidationRecord {
  if (input.generatorId === input.validatorId) {
    throw new DomainError(
      'POLICY_BLOCKED',
      'validator must be independent of the generator (TM-10)',
    );
  }

  const sign = (verdict: ValidationVerdict, reasonCodes: string[]): ValidationRecord => ({
    candidateId: input.candidateId,
    validatorId: input.validatorId,
    validatorVersion: input.validatorVersion,
    verdict,
    reasonCodes,
    signedAt: now(),
  });

  // AT-39: safety validator outage => fail closed, before any PASS can be reached.
  if (!input.safety.available) {
    return sign('UNAVAILABLE', ['SAFETY_VALIDATOR_UNAVAILABLE']);
  }

  // Hard failures (AT-20 wrong Math key; AT-21 unsafe/off-topic).
  const fail: string[] = [];
  if (input.math.ran && input.math.correct === false) fail.push('MATH_ANSWER_KEY_WRONG');
  if (input.safety.pass === false) fail.push('SAFETY_BLOCKED');
  if (input.onTopic === false) fail.push('OFF_TOPIC');
  if (fail.length > 0) return sign('FAIL', fail);

  // Any inconclusive signal that matters => UNCERTAIN (never delivered).
  const uncertain =
    input.safety.pass === null ||
    input.onTopic === null ||
    (input.math.ran && input.math.correct === null);
  if (uncertain) return sign('UNCERTAIN', ['INCONCLUSIVE']);

  // All independent checks affirmatively passed.
  const ok = ['SAFE', 'ON_TOPIC'];
  if (input.math.ran) ok.push('MATH_ANSWER_KEY_CORRECT');
  return sign('PASS', ok);
}

/** Stable, signed reference for the content-gate and audit trace (CONT-006). */
export function validationRecordRef(r: ValidationRecord): string {
  return `vr:${r.validatorId}@${r.validatorVersion}:${r.candidateId}:${r.verdict}`;
}
