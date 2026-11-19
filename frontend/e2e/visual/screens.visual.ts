// Captures de référence (login, accueil tenant_admin, plan de classement) sur API simulée.
// Mode d'emploi : e2e/visual/README.md.
import { expect, test as base } from '@playwright/test';
import { mockApi, signInAsTenantAdmin } from './api-mock';
import { ERROR_SCREEN_TITLE, GUARD_MESSAGES, expectAllMocked, expectScreen } from './screen-guard';

/** `unmocked` branche la maquette ; à la fin du test, la liste doit être restée vide (même après la capture). */
const test = base.extend<{ unmocked: string[] }>({
  unmocked: async ({ page }, use) => {
    const unmocked = await mockApi(page);
    await use(unmocked);
    expectAllMocked(unmocked);
  },
});

test.beforeEach(async ({ page }) => {
  // Date figée : les écrans qui affichent « aujourd'hui » restent comparables d'un jour à l'autre.
  await page.clock.setFixedTime(new Date('2026-01-15T10:00:00+01:00'));
});

test('connexion', async ({ page, unmocked }) => {
  await page.goto('./');

  // La liste déroulante n'existe que si la liste des institutions a été chargée (sinon : saisie libre).
  const institutions = page.locator('select#institution');
  await expectScreen(page, institutions, unmocked);
  await expect(institutions.getByRole('option', { name: 'Ministère des Finances (MINFI)' })).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1, name: 'Connexion' })).toBeVisible();
  await expect(page).toHaveScreenshot('login.png', { fullPage: true });
});

test('accueil tenant_admin', async ({ page, unmocked }) => {
  await signInAsTenantAdmin(page);
  await page.goto('dashboard');

  await expectScreen(page, page.getByText('Suivi des validations'), unmocked);
  await expect(page.getByRole('heading', { name: "Vue D'Ensemble" })).toBeVisible();
  await expect(page).toHaveScreenshot('dashboard-tenant-admin.png', { fullPage: true });
});

test('plan de classement', async ({ page, unmocked }) => {
  await signInAsTenantAdmin(page);
  await page.goto('classement');

  await expectScreen(page, page.getByText('Finances publiques').first(), unmocked);
  await expect(page.getByRole('heading', { level: 1, name: 'Plan de classement' })).toBeVisible();
  await expect(page).toHaveScreenshot('classement.png', { fullPage: true });
});

// Preuve de la garde : une situation par clause, et c'est bien cette clause qui refuse.
test.describe('la garde refuse', () => {
  test('un écran sans son repère (réponse `{}` de LESSON-2026-035)', async ({ page }) => {
    const unmocked = await mockApi(page);
    await page.route('**/api/v1/analytics/tenant', (route) => route.fulfill({ json: {} }));
    await signInAsTenantAdmin(page);
    await page.goto('dashboard');

    await expect(page.getByRole('heading', { name: ERROR_SCREEN_TITLE })).toBeVisible();
    await expect(expectScreen(page, page.getByText('Suivi des validations'), unmocked, 2_000)).rejects.toThrow(
      GUARD_MESSAGES.marker,
    );
  });

  test('l’écran d’erreur même si le repère y est visible', async ({ page }) => {
    const unmocked = await mockApi(page);
    await page.route('**/api/v1/analytics/tenant', (route) => route.fulfill({ json: {} }));
    await signInAsTenantAdmin(page);
    await page.goto('dashboard');

    // Repère mal choisi : le bouton de l'écran d'erreur lui-même.
    const marker = page.getByRole('button', { name: 'Recharger la page' });
    await expect(expectScreen(page, marker, unmocked, 2_000)).rejects.toThrow(GUARD_MESSAGES.errorScreen);
  });

  test('un écran qui appelle une route retirée de la maquette', async ({ page }) => {
    const unmocked = await mockApi(page, { omit: ['/notifications'] });
    await signInAsTenantAdmin(page);
    await page.goto('dashboard');

    await expect.poll(() => unmocked).toContainEqual(expect.stringMatching(/^GET \/notifications\/?$/));
    await expect(expectScreen(page, page.getByText('Suivi des validations'), unmocked, 2_000)).rejects.toThrow(
      GUARD_MESSAGES.unmocked,
    );
  });
});
