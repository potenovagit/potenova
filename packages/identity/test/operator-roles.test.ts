import { describe, it, expect } from 'vitest';
import {
  OPERATOR_ROLES,
  operatorCan,
  permissionsFor,
  assertOperatorPermission,
  isOperatorRole,
  isSensitiveOperatorPermission,
} from '../src/operator-roles';
import type { ActorContext } from '@potenova/contracts';

/**
 * Operator RBAC (SEC-013). Least-privilege by role: only `admin` administers
 * accounts and other operators; `support`/`read_only` are read-only. Fail-closed
 * by omission — an unknown role or a non-operator actor holds nothing.
 */

const operator = (): ActorContext => ({
  actorType: 'operator',
  actorAlias: 'op1',
  familyAlias: null,
  purpose: 'support',
});

describe('operator role model', () => {
  it('admin holds every operator permission', () => {
    expect(operatorCan('admin', 'operator:read')).toBe(true);
    expect(operatorCan('admin', 'operator:account_admin')).toBe(true);
    expect(operatorCan('admin', 'operator:operator_admin')).toBe(true);
  });

  it('support and read_only are read-only (no admin permissions)', () => {
    for (const role of ['support', 'read_only'] as const) {
      expect(operatorCan(role, 'operator:read')).toBe(true);
      expect(operatorCan(role, 'operator:account_admin')).toBe(false);
      expect(operatorCan(role, 'operator:operator_admin')).toBe(false);
    }
  });

  it('an undefined / unknown role holds nothing (fail-closed)', () => {
    expect(operatorCan(undefined, 'operator:read')).toBe(false);
    expect(isOperatorRole('superuser')).toBe(false);
    expect(isOperatorRole('admin')).toBe(true);
    expect(OPERATOR_ROLES).toContain('admin');
    expect(permissionsFor('read_only')).toEqual(['operator:read']);
  });

  it('assertOperatorPermission throws for a non-operator actor', () => {
    const guardian: ActorContext = {
      actorType: 'guardian',
      actorAlias: 'g1',
      familyAlias: 'fam1',
      purpose: 'support',
    };
    expect(() =>
      assertOperatorPermission({
        actor: guardian,
        operatorRole: 'admin',
        permission: 'operator:read',
      }),
    ).toThrowError(/operator actor/);
  });

  it('assertOperatorPermission throws when the role lacks the permission', () => {
    expect(() =>
      assertOperatorPermission({
        actor: operator(),
        operatorRole: 'read_only',
        permission: 'operator:account_admin',
      }),
    ).toThrowError(/operator:account_admin/);
  });

  it('assertOperatorPermission passes for an admin with the permission when elevated', () => {
    expect(() =>
      assertOperatorPermission({
        actor: operator(),
        operatorRole: 'admin',
        permission: 'operator:account_admin',
        elevated: true,
      }),
    ).not.toThrow();
  });

  it('classifies sensitive permissions (JIT required) vs reads', () => {
    expect(isSensitiveOperatorPermission('operator:account_admin')).toBe(true);
    expect(isSensitiveOperatorPermission('operator:operator_admin')).toBe(true);
    expect(isSensitiveOperatorPermission('operator:read')).toBe(false);
  });

  it('a sensitive permission requires elevation even for an admin (SEC-002)', () => {
    expect(() =>
      assertOperatorPermission({
        actor: operator(),
        operatorRole: 'admin',
        permission: 'operator:account_admin',
        elevated: false,
      }),
    ).toThrowError(/just-in-time elevation/);
  });

  it('read is never sensitive — no elevation needed', () => {
    expect(() =>
      assertOperatorPermission({
        actor: operator(),
        operatorRole: 'read_only',
        permission: 'operator:read',
      }),
    ).not.toThrow();
  });
});
