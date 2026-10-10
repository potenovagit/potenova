import { describe, it, expect } from 'vitest';
import {
  createRun,
  transitionRun,
  canTransitionRun,
  startFreshDiagnostic,
  type DiagnosticRun,
} from '@potenova/diagnostic';
import { isDomainError } from '@potenova/contracts';

const newRun = (): DiagnosticRun =>
  createRun({
    runId: 'run-1',
    learnerAlias: 'lnr-alias',
    subject: 'math',
    curriculumReleaseId: 'REL-ONT-MATH-2020-draft',
    targetSkillIds: ['SK-FR-compare'],
  });

describe('DiagnosticRun lifecycle (§3.2, AT-06/07)', () => {
  it('walks CREATED -> ACTIVE -> SUFFICIENT -> REVIEWED -> CLOSED', () => {
    let r = newRun();
    expect(r.state).toBe('CREATED');
    r = transitionRun(r, 'ACTIVE');
    r = transitionRun(r, 'SUFFICIENT');
    r = transitionRun(r, 'REVIEWED');
    r = transitionRun(r, 'CLOSED');
    expect(r.state).toBe('CLOSED');
  });

  it('an INTERRUPTED run resumes to ACTIVE', () => {
    let r = transitionRun(newRun(), 'ACTIVE');
    r = transitionRun(r, 'INTERRUPTED');
    expect(canTransitionRun('INTERRUPTED', 'ACTIVE')).toBe(true);
    r = transitionRun(r, 'ACTIVE');
    expect(r.state).toBe('ACTIVE');
  });

  it('rejects an illegal transition (CREATED -> SUFFICIENT)', () => {
    try {
      transitionRun(newRun(), 'SUFFICIENT');
      throw new Error('expected POLICY_BLOCKED');
    } catch (e) {
      expect(isDomainError(e) && e.code).toBe('POLICY_BLOCKED');
    }
  });

  it('AT-06/DIA-010: a fresh diagnostic is a new, separately versioned run; prior is untouched', () => {
    const prior = transitionRun(transitionRun(newRun(), 'ACTIVE'), 'SUFFICIENT');
    const fresh = startFreshDiagnostic(prior, 'run-2');
    expect(fresh.runId).toBe('run-2');
    expect(fresh.runVersion).toBe(2);
    expect(fresh.state).toBe('CREATED');
    // prior object unchanged (immutable history preserved)
    expect(prior.runId).toBe('run-1');
    expect(prior.runVersion).toBe(1);
    expect(prior.state).toBe('SUFFICIENT');
  });
});
