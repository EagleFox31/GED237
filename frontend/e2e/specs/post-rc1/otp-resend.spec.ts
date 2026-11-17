import type { APIRequestContext } from '@playwright/test';
import { test, expect, API_URL, TEST_USERS } from '../../fixtures/uat.fixture';

/**
 * Post-rc1 L4 (#154): POST /auth/resend-otp sends a new code for an open login session.
 * Real backend, dev_response channel (ENVIRONMENT=development echoes the code). That channel sends no
 * message, so login does not start the resend delay; each resend does (AUTH_OTP_RESEND_COOLDOWN_SECONDS,
 * 30 s by default). A second resend inside the delay is refused with 429 and retry_after; once it has
 * elapsed, a new code is sent and only the latest code works.
 */
const resend = (request: APIRequestContext, sessionToken: string) =>
  request.post(`${API_URL}/auth/resend-otp`, { data: { session_token: sessionToken } });

test('renvoi du code : refusé pendant le délai, puis nouveau code seul valide', async ({ request }) => {
  test.slow(); // waits out the 30 s delay

  const creds = TEST_USERS.collaborator;
  const login = await request.post(`${API_URL}/auth/login`, {
    data: { institution: creds.institution, matricule: creds.matricule, password: creds.password },
  });
  expect(login.ok()).toBeTruthy();
  const { session_token, otp: loginOtp } = await login.json();
  expect(loginOtp, 'OTP echoed only with ENVIRONMENT=development').toBeTruthy();

  // Unknown session: no code sent.
  expect((await resend(request, `unknown-${Date.now()}`)).status()).toBe(401);

  // First resend: a new code for the same session; the delay starts.
  const first = await resend(request, session_token);
  expect(first.status()).toBe(200);
  const firstBody = await first.json();
  expect(firstBody.session_token).toBe(session_token);
  expect(firstBody.otp).toBeTruthy();

  // Second resend right away: too soon.
  const tooSoon = await resend(request, session_token);
  expect(tooSoon.status()).toBe(429);
  const problem = await tooSoon.json();
  expect(problem.error_code).toBe('OTP_RESEND_TOO_SOON');
  expect(problem.retry_after).toBeGreaterThanOrEqual(1);
  expect(problem.retry_after).toBeLessThanOrEqual(30);

  // After the announced delay: another new code.
  await new Promise((resolve) => setTimeout(resolve, (problem.retry_after + 1) * 1000));
  const second = await resend(request, session_token);
  expect(second.status()).toBe(200);
  const latestOtp: string = (await second.json()).otp;
  expect(latestOtp).toBeTruthy();

  // Earlier code refused, latest code accepted (a success clears the failure counter).
  const verify = (otp: string) => request.post(`${API_URL}/auth/verify-otp`, { data: { session_token, otp } });
  const earlier = [loginOtp, firstBody.otp].find((code) => code !== latestOtp);
  if (earlier) expect((await verify(earlier)).status()).toBe(401);
  const ok = await verify(latestOtp);
  expect(ok.status()).toBe(200);
  expect((await ok.json()).access_token).toBeTruthy();
});
