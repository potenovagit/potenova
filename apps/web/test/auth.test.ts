import { describe, it, expect, vi, afterEach } from 'vitest';
import { signIn, guardianHeaders } from '../src/api';

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

    // After sign-in, guardian headers include the session token as a Bearer.
    const headers = guardianHeaders(res.actor.familyId, res.actor.guardianId);
    expect(headers.authorization).toBe('Bearer sess-token-abc');
    expect(headers['x-actor-type']).toBe('guardian');
    expect(headers['x-guardian-role']).toBe('owner');
  });
});
