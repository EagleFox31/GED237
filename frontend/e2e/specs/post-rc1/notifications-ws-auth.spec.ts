import type { Page } from '@playwright/test';
import { test, expect, API_URL, TEST_USERS } from '../../fixtures/uat.fixture';

/**
 * Post-rc1 L6 (#155): the notifications WebSocket accepts an access token only, and not once revoked.
 * Real backend. The socket is opened from the browser, as the app does (useNotifications).
 * A refused handshake never fires `open`; an accepted one does (positive control first).
 */
const WS_URL = `${API_URL.replace(/^http/, 'ws')}/notifications/ws`;

async function wsOpens(page: Page, token: string): Promise<boolean> {
  return page.evaluate(
    ({ url, timeoutMs }) =>
      new Promise<boolean>((resolve) => {
        const socket = new WebSocket(url);
        const done = (opened: boolean) => {
          clearTimeout(timer);
          socket.close();
          resolve(opened);
        };
        const timer = setTimeout(() => done(false), timeoutMs);
        socket.onopen = () => done(true);
        socket.onclose = () => done(false);
        socket.onerror = () => done(false);
      }),
    { url: `${WS_URL}?token=${encodeURIComponent(token)}`, timeoutMs: 10_000 },
  );
}

test('WebSocket des notifications : jeton d’accès accepté, jeton de rafraîchissement et jeton révoqué refusés', async ({
  page,
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

  await page.goto('about:blank');
  expect(await wsOpens(page, access_token)).toBe(true);
  expect(await wsOpens(page, refresh_token)).toBe(false);
  expect(await wsOpens(page, 'not-a-jwt')).toBe(false);

  const logout = await request.post(`${API_URL}/auth/logout`, { headers: { Authorization: `Bearer ${access_token}` } });
  expect(logout.ok()).toBeTruthy();
  expect(await wsOpens(page, access_token)).toBe(false);
});
