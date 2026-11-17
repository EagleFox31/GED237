import type { APIRequestContext } from '@playwright/test';
import { test, expect, API_URL, TEST_USERS } from '../../fixtures/uat.fixture';

/**
 * Post-rc1 L4 (#154): POST /auth/resend-otp sends a new code for an open login session.
 * Real backend, dev_response channel (ENVIRONMENT=development echoes the code). The resend cooldown
 * (AUTH_OTP_RESEND_COOLDOWN_SECONDS, 30 s by default) starts at login: an immediate resend is refused
 * with 429 and retry_after; once it has elapsed, the new code works and the previous one no longer does.
 */
const resend = (request: APIRequestContext, sessionToken: string) =>
  request.post(`${API_URL}/auth/resend-otp`, { data: { session_token: sessionToken } });

test('renvoi du code : refusé pendant le délai, puis nouveau code seul valide', async ({ request }) => {
  test.slow(); // waits out the 30 s cooldown

  const creds = TEST_USERS.collaborator;
  const login = await request.post(`${API_URL}/auth/login`, {
    data: { institution: creds.institution, matricule: creds.matricule, password: creds.password },
  });
  expect(login.ok()).toBeTruthy();
  const { session_token, otp: firstOtp } = await login.json();
  expect(firstOtp, 'OTP echoed only with ENVIRONMENT=development').toBeTruthy();

  // Unknown session: no code sent.
  expect((await resend(request, `unknown-${Date.now()}`)).status()).toBe(401);

  // Right after login: too soon.
  const tooSoon = await resend(request, session_token);
  expect(tooSoon.status()).toBe(429);
  const problem = await tooSoon.json();
  expect(problem.error_code).toBe('OTP_RESEND_TOO_SOON');
  expect(problem.retry_after).toBeGreaterThanOrEqual(1);
  expect(problem.retry_after).toBeLessThanOrEqual(30);

  // After the announced delay: a new code, same session.
  await new Promise((resolve) => setTimeout(resolve, (problem.retry_after + 1) * 1000));
  const resent = await resend(request, session_token);
  expect(resent.status()).toBe(200);
  const body = await resent.json();
  expect(body.session_token).toBe(session_token);
  expect(body.otp).toBeTruthy();
  expect(body.otp).not.toBe(firstOtp);

  // The cooldown starts again with each code sent.
  expect((await resend(request, session_token)).status()).toBe(429);

  // Previous code refused, new code accepted (a success clears the failure counter).
  const verify = (otp: string) => request.post(`${API_URL}/auth/verify-otp`, { data: { session_token, otp } });
  expect((await verify(firstOtp)).status()).toBe(401);
  const ok = await verify(body.otp);
  expect(ok.status()).toBe(200);
  expect((await ok.json()).access_token).toBeTruthy();
});
