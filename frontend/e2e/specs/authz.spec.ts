import { test, expect } from '../fixtures/auth.fixture';

/**
 * Feature: Droits d'accès (/authz)
 *
 *   - super_admin : 3 onglets (Droits / Metriques / Sante)
 *   - grille rôles × actions lue via GET /authz/policies (#280, lot 8b)
 *   - tenant_admin : la grille seule, en lecture
 *   - Basculer vers l'onglet Sante
 */
const READ_ONLY_SERVER = 'Lecture seule sur cette installation : les droits se règlent sur le serveur.';

test.describe('Feature: AuthZ Admin', () => {

  test('Given super_admin, When open /authz, Then 3 tabs are visible', async ({ loginAs, page }) => {
    await loginAs('super_admin');
    await page.goto('authz');

    await expect(page.getByRole('heading', { name: /droits d'accès/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: 'Droits', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /metriques/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /sante/i })).toBeVisible();
  });

  test('Given /authz in csv mode, When open, Then the grid is shown read-only', async ({ loginAs, page }) => {
    await loginAs('super_admin');

    const policiesPromise = page.waitForResponse(r => /\/authz\/policies/.test(r.url()) && r.request().method() === 'GET');
    await page.goto('authz');
    const policies = await policiesPromise;

    // La pile e2e tourne en AUTHZ_BACKEND=csv (défaut) : la grille montre policy.csv,
    // /authz/roles répond 409, donc aucune case n'est modifiable, avec un message lisible.
    expect(policies.status()).toBe(200);
    const grid = page.getByTestId('rights-grid');
    await expect(grid).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('rights-read-only')).toHaveText(READ_ONLY_SERVER);
    await page.getByRole('button', { name: 'Documents', exact: true }).click();
    // policy.csv : `p, tenant_admin, documents, read`.
    // exact : « Consulter » est aussi le début de « Consulter les siens ».
    const cell = grid.getByRole('checkbox', { name: 'Admin Ministère : Consulter', exact: true });
    await expect(cell).toBeChecked();
    await expect(cell).toBeDisabled();
    await expect(page.getByText(/AUTHZ_BACKEND/)).toHaveCount(0);
  });

  test('Given tenant_admin, When open /authz, Then the grid alone, read-only', async ({ loginAs, page }) => {
    await loginAs('tenant_admin');
    await page.goto('authz');

    await expect(page.getByTestId('rights-grid')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('rights-read-only')).toHaveText(
      'Lecture seule : seul le super-administrateur change les droits.'
    );
    await expect(page.getByRole('button', { name: /metriques/i })).toBeHidden();
    await expect(page.getByTestId('rights-grid').getByRole('checkbox').first()).toBeDisabled();
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
