import { test, expect, TEST_USERS, API_URL } from '../../fixtures/uat.fixture';
import { LoginPage } from '../../pages/login.page';
import type { Page } from '@playwright/test';

/**
 * UAT — Phase de Conception/GUIDE_TEST_FONCTIONNEL.md
 * SC-AUTH-01 : se connecter (2FA), exceptions E1, E2, E3 (verrou après 3 codes faux, sur un compte jetable) ;
 * SC-AUTH-02 : prolonger la session (refresh silencieux), E1 ; SC-AUTH-03 : se déconnecter.
 * Backend réel, OTP renvoyé par l'API en ENVIRONMENT=development (alternative A1).
 */

/** Returns a 6-digit code guaranteed to differ from `code` on every digit. */
function wrongOtp(code: string): string {
  return code
    .split('')
    .map((d) => String((Number(d) + 1) % 10))
    .join('');
}

async function readOtp(page: import('@playwright/test').Page): Promise<string> {
  let code = '';
  for (let i = 0; i < 6; i++) code += await page.locator(`#otp-${i}`).inputValue();
  return code;
}

// These specs test the login itself: every loginAs goes through the real form.
test.use({ freshLogin: true });

test.describe('SC-AUTH-01 — Se connecter (2FA)', () => {
  test('séquence principale : ministère, matricule, mot de passe, OTP, tableau de bord', async ({ page }) => {
    const lp = new LoginPage(page);
    const admin = TEST_USERS.tenant_admin;

    await lp.goto();
    await lp.fillCredentials(admin.institution, admin.matricule, admin.password);
    await lp.submitLogin();

    await lp.waitForOtpStep();
    await expect(page.getByText('Code MFA')).toBeVisible();
    await lp.expectOtpPreFilled();
    await lp.submitOtp();

    await lp.expectDashboardVisible();
    const token = await page.evaluate(() => sessionStorage.getItem('access_token'));
    expect(token, 'le jeton est stocké en sessionStorage après la 2FA').toBeTruthy();
  });

  test('E1 : mot de passe incorrect → message générique, pas d’étape OTP', async ({ page }) => {
    const lp = new LoginPage(page);
    const admin = TEST_USERS.tenant_admin;

    await lp.goto();
    await lp.fillCredentials(admin.institution, admin.matricule, 'Mauvais@2025');
    await lp.submitLogin();

    await lp.expectErrorVisible('Vérifiez vos identifiants');
    await expect(page.locator('#otp-0')).toHaveCount(0);
    await lp.expectLoginPageVisible();
  });

  test('E2 : code OTP erroné → « Code invalide », puis nouvelle saisie acceptée', async ({ page }) => {
    const lp = new LoginPage(page);
    const admin = TEST_USERS.tenant_admin;

    await lp.goto();
    await lp.fillCredentials(admin.institution, admin.matricule, admin.password);
    await lp.submitLogin();
    await lp.waitForOtpStep();
    await lp.expectOtpPreFilled();

    const goodCode = await readOtp(page);
    await lp.fillOtp(wrongOtp(goodCode));
    await lp.submitOtp();
    await lp.expectErrorVisible('Code invalide');
    await expect(page.locator('#otp-0')).toBeVisible();

    await lp.fillOtp(goodCode);
    await lp.submitOtp();
    await lp.expectDashboardVisible();
  });

  // #83 (API : 3 codes faux → 423 pendant AUTH_LOCKOUT_SECONDS) et #88 (écran du verrou).
  // Compte jetable créé ici : le verrou bloque le compte 15 min, jamais un compte de la démo.
  test('E3 : trois OTP erronés → compte verrouillé, message explicite, même le bon mot de passe est refusé', async ({
    page,
    request,
    adminApi,
    runId,
  }) => {
    const institution = TEST_USERS.tenant_admin.institution;
    const matricule = `VERROU-${runId}`.toUpperCase();
    const password = 'Verrou@2025';
    const { tenant_id } = await adminApi.me();
    await adminApi.createUser({ matricule, password, roleCode: 'reader', tenantId: tenant_id });

    const lp = new LoginPage(page);
    await lp.goto();
    await lp.fillCredentials(institution, matricule, password);
    await lp.submitLogin();
    await lp.waitForOtpStep();
    await lp.expectOtpPreFilled();

    const goodCode = await readOtp(page);
    for (let attempt = 1; attempt <= 2; attempt++) {
      await lp.fillOtp(wrongOtp(goodCode));
      await lp.submitOtp();
      await lp.expectErrorVisible('Code invalide');
      await expect(page.locator('#otp-0'), `essai ${attempt} : la saisie du code reste ouverte`).toBeVisible();
    }

    // Troisième code faux : retour aux identifiants, délai restant affiché (≤ 15 min), bouton bloqué.
    await lp.fillOtp(wrongOtp(goodCode));
    await lp.submitOtp();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.getByText(/Compte verrouillé\. Réessayez dans 1[0-5] min/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Compte verrouillé' })).toBeDisabled();
    expect(await page.evaluate(() => sessionStorage.getItem('access_token'))).toBeNull();

    // Pendant le verrou, le bon mot de passe est refusé lui aussi (il n'est même pas vérifié).
    const relogin = await request.post(`${API_URL}/auth/login`, { data: { institution, matricule, password } });
    expect(relogin.status(), 'connexion pendant le verrou').toBe(423);
    expect((await relogin.json()).error_code).toBe('ACCOUNT_LOCKED');
  });
});

const BOGUS_TOKEN = 'uat.expired.token';

test.describe('SC-AUTH-02 — Prolonger une session active', () => {
  test('jeton d’accès expiré : rafraîchi silencieusement, la page demandée s’affiche', async ({ page, loginAs }) => {
    await loginAs('tenant_admin');
    await page.evaluate((bogus) => {
      sessionStorage.setItem('access_token', bogus);
      sessionStorage.setItem('token', bogus);
    }, BOGUS_TOKEN);

    const refresh = page.waitForResponse((r) => r.url().endsWith('/auth/refresh') && r.request().method() === 'POST');
    await page.goto('documents');
    expect((await refresh).ok(), 'POST /auth/refresh accepté').toBe(true);

    await expect(page).toHaveURL(/\/documents/);
    await expect(page.locator('#password')).toHaveCount(0);
    const next = await page.evaluate(() => sessionStorage.getItem('access_token'));
    expect(next, 'un nouveau jeton d’accès est stocké').toBeTruthy();
    expect(next).not.toBe(BOGUS_TOKEN);
  });

  test('E1 : jeton de rafraîchissement invalide → écran de connexion', async ({ page, loginAs }) => {
    await loginAs('tenant_admin');
    await page.evaluate((bogus) => {
      sessionStorage.setItem('access_token', bogus);
      sessionStorage.setItem('token', bogus);
      sessionStorage.setItem('refresh_token', bogus);
    }, BOGUS_TOKEN);

    await page.goto('documents');
    await new LoginPage(page).expectLoginPageVisible();
    expect(await page.evaluate(() => sessionStorage.getItem('access_token'))).toBeNull();
  });

  const DESTINATION = 'audit?e2e=destination';

  async function expireOn(page: Page) {
    await page.evaluate((bogus) => {
      sessionStorage.setItem('access_token', bogus);
      sessionStorage.setItem('token', bogus);
      sessionStorage.setItem('refresh_token', bogus);
    }, BOGUS_TOKEN);
    await page.goto(DESTINATION);
    await new LoginPage(page).expectLoginPageVisible();
    expect(await page.evaluate(() => sessionStorage.getItem('post_login_destination')), 'destination mémorisée').toContain('/audit?e2e=destination');
  }

  async function relog(page: Page, user: { institution: string; matricule: string; password: string }) {
    const lp = new LoginPage(page);
    await lp.fillCredentials(user.institution, user.matricule, user.password);
    await lp.submitLogin();
    await lp.waitForOtpStep();
    await lp.expectOtpPreFilled();
    await lp.submitOtp();
  }

  test('E1 : la destination voulue (avec ses paramètres) est conservée après reconnexion du même compte', async ({ page, loginAs }) => {
    await loginAs('tenant_admin');
    await expireOn(page);
    await relog(page, TEST_USERS.tenant_admin);
    await expect(page).toHaveURL(/\/audit\?e2e=destination/);
  });

  test('E1 : un autre compte ne reprend pas la destination et arrive sur sa page d’accueil', async ({ page, loginAs }) => {
    await loginAs('tenant_admin');
    await expireOn(page);
    await relog(page, TEST_USERS.collaborator);
    await expect(page).not.toHaveURL(/\/audit/);
    await new LoginPage(page).expectDashboardVisible();
  });

  test('E1 : un autre compte du même rôle (autre ministère) ne reprend pas la destination', async ({ page, loginAs }) => {
    await loginAs('collaborator');
    await expireOn(page);
    // MINESUP001 est aussi collaborateur : même profil de rôle, compte et ministère différents.
    await relog(page, { institution: 'Ministère de l’Enseignement Supérieur (MINESUP)', matricule: 'MINESUP001', password: 'Sup@2025' });
    await expect(page).not.toHaveURL(/\/audit/);
    await new LoginPage(page).expectDashboardVisible();
  });
});

test.describe('SC-AUTH-03 — Se déconnecter', () => {
  test('déconnexion : session vidée, retour à l’écran de connexion, pages protégées inaccessibles', async ({ page, loginAs }) => {
    await loginAs('tenant_admin');

    await page.locator('header button[aria-haspopup="menu"]').click();
    await page.getByRole('menuitem', { name: /Se déconnecter/i }).click();

    const lp = new LoginPage(page);
    await lp.expectLoginPageVisible();
    expect(await page.evaluate(() => sessionStorage.getItem('access_token'))).toBeNull();

    // Retour arrière / accès direct à une page protégée : l'écran de connexion reste affiché.
    await page.goBack();
    await page.goto('documents');
    await lp.expectLoginPageVisible();
  });
});
