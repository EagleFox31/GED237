import { test, expect } from '../fixtures/auth.fixture';

/**
 * Garde des routes d'administration (ADMIN_ROUTES / RequireProfile, frontend/App.tsx).
 * Spec : gestion-projet/innovateur/spec-garde-routes.md, cas GUARD-01..06.
 *
 * Confort d'interface : une URL réservée tapée par un non-admin renvoie vers sa page d'accueil
 * avec un message, sans monter la page. Le contrôle d'accès fait foi côté API.
 */

const DENIED = 'Accès réservé aux administrateurs.';
const USERS_API = /\/api\/v1\/users(\?|$)/;

test.describe('Garde des routes d’administration (GUARD-01..06)', () => {
  test('GUARD-01 — Given lecteur, When /users, Then retour à /documents avec message, page non montée', async ({ loginAs, page }) => {
    await loginAs('reader');
    await page.goto('users');
    await expect(page).toHaveURL(/\/documents$/);
    await expect(page.getByText(DENIED)).toBeVisible();
    await expect(page.getByRole('heading', { name: /agents/i })).toHaveCount(0);
  });

  test('GUARD-02 — Given lecteur, When /tenants, Then retour à /documents avec message', async ({ loginAs, page }) => {
    await loginAs('reader');
    await page.goto('tenants');
    await expect(page).toHaveURL(/\/documents$/);
    await expect(page.getByText(DENIED)).toBeVisible();
  });

  test('GUARD-03 — Given admin tenant, When /users, Then la page s’affiche sans message', async ({ loginAs, page }) => {
    await loginAs('tenant_admin');
    await page.goto('users');
    await expect(page).toHaveURL(/\/users$/);
    await expect(page.getByRole('heading', { name: /agents/i })).toBeVisible();
    await expect(page.getByText(DENIED)).toHaveCount(0);
  });

  test('GUARD-04 — Given admin tenant, When /tenants (réservé plateforme), Then retour à /dashboard avec message', async ({ loginAs, page }) => {
    await loginAs('tenant_admin');
    await page.goto('tenants');
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText(DENIED)).toBeVisible();
  });

  test('GUARD-05 — Given lecteur redirigé depuis /users, When Précédent, Then pas de retour sur /users', async ({ loginAs, page }) => {
    await loginAs('reader');
    await page.goto('users');
    await expect(page).toHaveURL(/\/documents$/);
    await page.goBack();
    await expect(page).not.toHaveURL(/\/users$/);
  });

  test('GUARD-06 — Given lecteur, When /users puis rechargement, Then pas de page blanche ni appel GET /users', async ({ loginAs, page }) => {
    await loginAs('reader');
    const usersCalls: string[] = [];
    page.on('request', (r) => {
      if (r.method() === 'GET' && USERS_API.test(r.url())) usersCalls.push(r.url());
    });

    await page.goto('users');
    await expect(page).toHaveURL(/\/documents$/);
    await page.reload();
    await expect(page).toHaveURL(/\/documents$/);
    await expect(page.locator('main')).not.toBeEmpty();
    await expect(page.locator('main')).toContainText(/\S/);

    await page.goto('users');
    await expect(page).toHaveURL(/\/documents$/);
    await page.waitForLoadState('networkidle');
    expect(usersCalls, 'la page /users ne doit jamais être montée pour un lecteur').toEqual([]);
  });
});
