import { test, expect } from '../fixtures/auth.fixture';
import type { Page } from '@playwright/test';

/**
 * Renouvellement de session (audit lot 6, point 1) :
 * - une coupure réseau pendant le renouvellement ne déconnecte pas ;
 * - un refus du serveur (401) déconnecte, avec « Votre session a expiré » une seule fois.
 * L'appel /auth/refresh est simulé ; le jeton d'accès est rendu invalide pour forcer le renouvellement.
 */
const REFRESH = '**/auth/refresh';

const expireAccessToken = (page: Page) =>
  page.evaluate(() => {
    sessionStorage.setItem('access_token', 'jeton-expire');
    sessionStorage.setItem('token', 'jeton-expire');
  });

test.describe('Renouvellement de session', () => {
  test.beforeEach(async ({ loginAs }) => loginAs('tenant_admin'));

  test('SESSION-01 : coupure réseau pendant le renouvellement → session gardée, erreur affichée, reprise ensuite', async ({ page }) => {
    await page.route(REFRESH, (route) => route.abort('internetdisconnected'));
    await expireAccessToken(page);
    const refreshFailed = page.waitForEvent('requestfailed', (r) => r.url().includes('/auth/refresh'));
    await page.reload();
    await refreshFailed;

    await expect(page.getByText(/serveur est injoignable/).first()).toBeVisible();
    await expect(page).not.toHaveURL(/\/login/);
    expect(await page.evaluate(() => sessionStorage.getItem('refresh_token'))).toBeTruthy();

    // Réseau rétabli : l'action suivante renouvelle la session sans repasser par la connexion.
    await page.unroute(REFRESH);
    const renewed = page.waitForResponse((r) => r.url().includes('/auth/refresh') && r.status() === 200);
    await page.reload();
    await renewed;
    await expect(page).not.toHaveURL(/\/login/);
    expect(await page.evaluate(() => sessionStorage.getItem('access_token'))).not.toBe('jeton-expire');
  });

  test('SESSION-02 : renouvellement refusé (401) → connexion avec « Votre session a expiré », une seule fois', async ({ page }) => {
    await page.route(REFRESH, (route) =>
      route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ detail: 'Invalid refresh token' }) })
    );
    await expireAccessToken(page);
    await page.reload();

    await expect(page).toHaveURL(/\/login/);
    const notice = page.getByRole('status').filter({ hasText: 'Votre session a expiré, reconnectez-vous.' });
    await expect(notice).toBeVisible();
    expect(await page.evaluate(() => sessionStorage.getItem('refresh_token'))).toBeNull();

    // Une seule fois : un rechargement de l'écran de connexion ne le répète pas.
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible();
    await expect(notice).toHaveCount(0);
  });
});
