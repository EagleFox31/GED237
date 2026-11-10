import { test, expect, TEST_USERS } from '../../fixtures/uat.fixture';
import { LoginPage } from '../../pages/login.page';

/**
 * UAT — Phase de Conception/GUIDE_TEST_FONCTIONNEL.md
 * SC-AUTH-01 : se connecter (2FA), exceptions E1, E2 (E3 en fixme : défaut ouvert) ;
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

  test('E3 : trois OTP erronés → session bloquée, retour à la saisie des identifiants', async ({ page }) => {
    test.fixme(true, 'Défaut SC-AUTH-01 E3 : aucun compteur de tentatives OTP (seule la limite slowapi 5/min).');
    const lp = new LoginPage(page);
    const admin = TEST_USERS.tenant_admin;

    await lp.goto();
    await lp.fillCredentials(admin.institution, admin.matricule, admin.password);
    await lp.submitLogin();
    await lp.waitForOtpStep();
    await lp.expectOtpPreFilled();

    const goodCode = await readOtp(page);
    for (let attempt = 0; attempt < 3; attempt++) {
      await lp.fillOtp(wrongOtp(goodCode));
      await lp.submitOtp();
      await expect(page.locator('p.text-red-500')).toBeVisible();
    }

    // La session OTP est invalidée : même le bon code ne permet plus d'entrer.
    if (await page.locator('#otp-0').isVisible()) {
      await lp.fillOtp(goodCode);
      await lp.submitOtp();
    }
    await expect(page.locator('#password')).toBeVisible();
    expect(await page.evaluate(() => sessionStorage.getItem('access_token'))).toBeNull();
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

  test('E1 : la destination voulue est conservée après reconnexion', async ({ page, loginAs }) => {
    test.fixme(true, 'Défaut SC-AUTH-02 E1 : redirectToLogin() (services/http/session.ts) ne conserve pas la destination.');
    await loginAs('tenant_admin');
    await page.evaluate((bogus) => {
      sessionStorage.setItem('access_token', bogus);
      sessionStorage.setItem('token', bogus);
      sessionStorage.setItem('refresh_token', bogus);
    }, BOGUS_TOKEN);
    await page.goto('documents');
    await new LoginPage(page).expectLoginPageVisible();

    const lp = new LoginPage(page);
    const admin = TEST_USERS.tenant_admin;
    await lp.fillCredentials(admin.institution, admin.matricule, admin.password);
    await lp.submitLogin();
    await lp.waitForOtpStep();
    await lp.expectOtpPreFilled();
    await lp.submitOtp();
    await expect(page).toHaveURL(/\/documents/);
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
