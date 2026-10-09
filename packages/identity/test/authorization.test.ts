import { describe, it, expect } from 'vitest';
import { assertCapability, type Capability } from '@potenova/identity';
import { type ActorContext, isDomainError } from '@potenova/contracts';

const guardian = (familyAlias: string): ActorContext => ({
  actorType: 'guardian',
  actorAlias: 'g-1',
  familyAlias,
  purpose: 'parent_reporting',
});
const child = (familyAlias: string): ActorContext => ({
  actorType: 'child',
  actorAlias: 'c-1',
  familyAlias,
  learnerAlias: 'l-1',
  purpose: 'tutoring',
});

function code(fn: () => void): string | null {
  try {
    fn();
    return null;
  } catch (e) {
    return isDomainError(e) ? e.code : 'OTHER';
  }
}

describe('role/capability authorization (ACC-003/004/005/007)', () => {
  it('AT-24: a child session cannot reach billing, even on a shared device', () => {
    expect(code(() => assertCapability({ actor: child('F1'), capability: 'manage_billing' }))).toBe(
      'FORBIDDEN_ROLE',
    );
    for (const cap of ['export_learner', 'delete_learner', 'invite_guardian'] as Capability[]) {
      expect(code(() => assertCapability({ actor: child('F1'), capability: cap }))).toBe(
        'FORBIDDEN_ROLE',
      );
    }
  });

  it('a child session CAN exercise its learning capabilities', () => {
    for (const cap of ['start_diagnostic', 'do_tutoring', 'submit_attempt'] as Capability[]) {
      expect(code(() => assertCapability({ actor: child('F1'), capability: cap }))).toBeNull();
    }
  });

  it('AT-02: a learning-viewer cannot export, delete, bill or invite', () => {
    for (const cap of [
      'export_learner',
      'delete_learner',
      'manage_billing',
      'invite_guardian',
    ] as Capability[]) {
      expect(
        code(() =>
          assertCapability({
            actor: guardian('F1'),
            capability: cap,
            guardianRole: 'learning_viewer',
          }),
        ),
      ).toBe('FORBIDDEN_ROLE');
    }
  });

  it('a learning-viewer CAN view progress', () => {
    expect(
      code(() =>
        assertCapability({
          actor: guardian('F1'),
          capability: 'view_progress',
          guardianRole: 'learning_viewer',
        }),
      ),
    ).toBeNull();
  });

  it('AT-52: an owner is denied a sensitive action without step-up, allowed with it', () => {
    expect(
      code(() =>
        assertCapability({
          actor: guardian('F1'),
          capability: 'delete_learner',
          guardianRole: 'owner',
        }),
      ),
    ).toBe('AUTH_REQUIRED');
    expect(
      code(() =>
        assertCapability({
          actor: guardian('F1'),
          capability: 'delete_learner',
          guardianRole: 'owner',
          stepUpSatisfied: true,
        }),
      ),
    ).toBeNull();
  });
});
