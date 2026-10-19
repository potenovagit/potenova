import { describe, it, expect, vi, afterEach } from 'vitest';
import { signIn, stepUp, guardianHeaders } from '../src/api';

/**
 * The web client's guardian sign-in exchange: signIn posts to /auth/session and
 * captures the returned Potenova session token, which guardian calls then carry
 * as a Bearer credential (alongside the dev header shim) — so the same call
 * authenticates under either auth mode.
 */

afterEach(() => {
  vi.restoreAllMocks();
});

const okJson = (body: unknown): Response =>
  ({ ok: true, status: 200, text: async () => JSON.stringify(body) }) as Response;

describe('guardian sign-in (web client)', () => {
  it('exchanges an IdP subject and carries the session token on guardian calls', async () => {
    // Before sign-in, guardian headers carry no bearer token.
    expect(guardianHeaders('fam-x', 'gdn-x').authorization).toBeUndefined();

    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as { idpSubject?: string };
      expect(body.idpSubject).toBe('idp-synthetic:guardian@example.com');
      return okJson({
        token: 'sess-token-abc',
        tokenType: 'Bearer',
        expiresAt: '2026-10-19T13:00:00.000Z',
        provisioned: true,
        actor: {
          actorType: 'guardian',
          guardianId: 'gdn-idp-123',
          familyId: 'fam-idp-123',
          role: 'owner',
          stepUp: false,
        },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await signIn('idp-synthetic:guardian@example.com');
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toContain('/auth/session');
    expect(init?.method).toBe('POST');
    expect(res.actor.familyId).toBe('fam-idp-123');
    expect(res.provisioned).toBe(true);

    // After sign-in, guardian headers include the session token as a Bearer and
    // are NOT yet stepped up.
    const headers = guardianHeaders(res.actor.familyId, res.actor.guardianId);
    expect(headers.authorization).toBe('Bearer sess-token-abc');
    expect(headers['x-actor-type']).toBe('guardian');
    expect(headers['x-guardian-role']).toBe('owner');
    expect(headers['x-step-up']).toBeUndefined();
  });

  it('stepUp elevates the session token and flags x-step-up on guardian calls', async () => {
    // Sign in first so there is a session token to elevate.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        okJson({
          token: 'sess-1',
          tokenType: 'Bearer',
          expiresAt: 'x',
          provisioned: true,
          actor: {
            actorType: 'guardian',
            guardianId: 'gdn-1',
            familyId: 'fam-1',
            role: 'owner',
            stepUp: false,
          },
        }),
      ),
    );
    await signIn('idp-synthetic:a@b.com');

    // Step up → /auth/step-up returns an elevated token, which replaces the session.
    const stepFetch = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toContain('/auth/step-up');
      expect((init?.headers as Record<string, string>).authorization).toBe('Bearer sess-1');
      return okJson({ token: 'sess-elevated', tokenType: 'Bearer', expiresAt: 'y', actor: {} });
    });
    vi.stubGlobal('fetch', stepFetch);
    await stepUp();
    expect(stepFetch).toHaveBeenCalledOnce();

    const headers = guardianHeaders('fam-1', 'gdn-1');
    expect(headers.authorization).toBe('Bearer sess-elevated');
    expect(headers['x-step-up']).toBe('true');
  });
});
