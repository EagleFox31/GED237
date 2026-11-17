// Captures de référence (login, accueil tenant_admin, plan de classement) sur API simulée.
// Mode d'emploi : e2e/visual/README.md.
import { expect, test } from '@playwright/test';
import { mockApi, signInAsTenantAdmin } from './api-mock';
import { ERROR_SCREEN_TITLE, expectScreen } from './screen-guard';

test.beforeEach(async ({ page }) => {
  // Date figée : les écrans qui affichent « aujourd'hui » restent comparables d'un jour à l'autre.
  await page.clock.setFixedTime(new Date('2026-01-15T10:00:00+01:00'));
});

test('connexion', async ({ page }) => {
  const unmocked = await mockApi(page);
  await page.goto('./');

  // La liste déroulante n'existe que si la liste des institutions a été chargée (sinon : saisie libre).
  const institutions = page.locator('select#institution');
  await expectScreen(page, institutions, unmocked);
  await expect(institutions.getByRole('option', { name: 'Ministère des Finances (MINFI)' })).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1, name: 'Connexion' })).toBeVisible();
  await expect(page).toHaveScreenshot('login.png', { fullPage: true });
});

test('accueil tenant_admin', async ({ page }) => {
  const unmocked = await mockApi(page);
  await signInAsTenantAdmin(page);
  await page.goto('dashboard');

  await expectScreen(page, page.getByText('Résumé Des Workflows'), unmocked);
  await expect(page.getByRole('heading', { name: "Vue D'Ensemble" })).toBeVisible();
  await expect(page).toHaveScreenshot('dashboard-tenant-admin.png', { fullPage: true });
});

test('plan de classement', async ({ page }) => {
  const unmocked = await mockApi(page);
  await signInAsTenantAdmin(page);
  await page.goto('classement');

  await expectScreen(page, page.getByText('Finances publiques').first(), unmocked);
  await expect(page.getByRole('heading', { level: 1, name: 'Plan de classement' })).toBeVisible();
  await expect(page).toHaveScreenshot('classement.png', { fullPage: true });
});

// Contrôle de la garde : avec la réponse `{}` de LESSON-2026-035, l'accueil plante et la garde doit refuser.
test('la garde refuse l’écran d’erreur', async ({ page }) => {
  const unmocked = await mockApi(page);
  await page.route('**/api/v1/analytics/tenant', (route) => route.fulfill({ json: {} }));
  await signInAsTenantAdmin(page);
  await page.goto('dashboard');

  await expect(page.getByRole('heading', { name: ERROR_SCREEN_TITLE })).toBeVisible();
  await expect(expectScreen(page, page.getByText('Résumé Des Workflows'), unmocked, 2_000)).rejects.toThrow();
});
