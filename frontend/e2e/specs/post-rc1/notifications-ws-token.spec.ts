import { test, expect, API_URL, TEST_USERS } from '../../fixtures/uat.fixture';

/**
 * Post-rc1 L6 (#155): the notifications WebSocket accepts an access token only, and not once revoked.
 * Real backend. The handshake runs from Node (global WebSocket): a page on about:blank may not open a
 * socket to the api's private address, which would make the positive control fail for the wrong reason.
 * A refused handshake never fires `open`; an accepted one does (positive control first).
 * File name: must not end in `auth.spec.ts`, which the smoke project matches.
 */
const WS_URL = `${API_URL.replace(/^http/, 'ws')}/notifications/ws`;

function wsOpens(token: string, timeoutMs = 10_000): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const socket = new WebSocket(`${WS_URL}?token=${encodeURIComponent(token)}`);
    const done = (opened: boolean) => {
      clearTimeout(timer);
      socket.close();
      resolve(opened);
    };
    const timer = setTimeout(() => done(false), timeoutMs);
    socket.onopen = () => done(true);
    socket.onclose = () => done(false);
    socket.onerror = () => done(false);
  });
}

test('WebSocket des notifications : jeton d’accès accepté, jeton de rafraîchissement et jeton révoqué refusés', async ({
  request,
}) => {
  // Own session (not the worker's cached admin token): this test revokes it with a logout.
  const creds = TEST_USERS.collaborator;
  const login = await request.post(`${API_URL}/auth/login`, {
    data: { institution: creds.institution, matricule: creds.matricule, password: creds.password },
  });
  expect(login.ok()).toBeTruthy();
  const { session_token, otp } = await login.json();
  expect(otp, 'OTP echoed only with ENVIRONMENT=development').toBeTruthy();
  const verify = await request.post(`${API_URL}/auth/verify-otp`, { data: { session_token, otp } });
  expect(verify.ok()).toBeTruthy();
  const { access_token, refresh_token } = await verify.json();

  expect(await wsOpens(access_token)).toBe(true);
  expect(await wsOpens(refresh_token)).toBe(false);
  expect(await wsOpens('not-a-jwt')).toBe(false);

  const logout = await request.post(`${API_URL}/auth/logout`, { headers: { Authorization: `Bearer ${access_token}` } });
  expect(logout.ok()).toBeTruthy();
  expect(await wsOpens(access_token)).toBe(false);
});
