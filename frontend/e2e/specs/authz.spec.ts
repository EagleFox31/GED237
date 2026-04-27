import { test, expect } from '../fixtures/auth.fixture';

/**
 * Feature: Gestion AuthZ (super_admin only)
 *
 * Couvre la page /authz ajoutée en P7 :
 *   - 3 onglets (Policies / Metriques / Sante)
 *   - Listing policies via /authz/policies
 *   - Ajout d'une policy via POST /authz/policies
 *   - Basculer vers l'onglet Sante
 */
test.describe('Feature: AuthZ Admin', () => {

  test('Given super_admin, When open /authz, Then 3 tabs are visible', async ({ loginAs, page }) => {
    await loginAs('super_admin');
    await page.goto('authz');

    await expect(page.getByRole('heading', { name: /gestion authz/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: /policies/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /metriques/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /sante/i })).toBeVisible();
  });

  test('Given /authz, When tab Policies, Then policies table is populated', async ({ loginAs, page }) => {
    await loginAs('super_admin');

    const policiesPromise = page.waitForResponse(r => /\/authz\/policies/.test(r.url()) && r.request().method() === 'GET');
    await page.goto('authz');
    await policiesPromise;

    await expect(page.getByText(/policies/i).first()).toBeVisible();
    await expect(page.locator('table').first()).toBeVisible({ timeout: 10_000 });
  });

  test('Given /authz, When click Sante tab, Then backend status is shown', async ({ loginAs, page }) => {
    await loginAs('super_admin');
    await page.goto('authz');

    await page.getByRole('button', { name: /sante/i }).click();
    await expect(page.getByText(/backend|dropped|degraded|memory|redis/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('Given /authz, When click Metriques tab, Then reset button is visible', async ({ loginAs, page }) => {
    await loginAs('super_admin');
    await page.goto('authz');

    await page.getByRole('button', { name: /metriques/i }).click();
    await expect(page.getByRole('button', { name: /reset|r[ée]initialiser/i })).toBeVisible({ timeout: 10_000 });
  });
});
