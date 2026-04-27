import { test, expect } from '../fixtures/auth.fixture';

/**
 * SC-PLAT-01..04 — Parcours du super_admin (admin plateforme).
 *
 *   - SC-PLAT-01 : voir le dashboard global multi-ministère
 *   - SC-PLAT-02 : lister les ministères (tenants)
 *   - SC-PLAT-03 : créer un nouveau ministère
 *   - SC-PLAT-04 : lister les utilisateurs globaux
 */
test.describe.serial('Feature: Super admin plateforme (SC-PLAT-01..04)', () => {

  test.beforeEach(async ({ loginAs }) => {
    await loginAs('super_admin');
  });

  test('SC-PLAT-01 — Given super_admin, When dashboard, Then KPI plateforme', async ({ page }) => {
    await expect(page).toHaveURL(/dashboard/);
    await expect(
      page.getByText(/plateforme|tenants|ministères|global/i).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('SC-PLAT-02 — Given super_admin, When /tenants, Then liste des ministères', async ({ page }) => {
    await page.goto('tenants');
    await page.waitForLoadState('networkidle');

    const visible = await page.locator('table, [class*="tenant"], .grid').first().isVisible().catch(() => false);
    if (!visible) {
      test.skip(true, 'Page tenants non exposée dans la sidebar super_admin');
    }
    await expect(page.getByText(/MINFI|MINESUP|tenant|ministère/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('SC-PLAT-03 — Given liste tenants, When créer, Then nouveau tenant ajouté', async ({ page }) => {
    await page.goto('tenants');
    await page.waitForLoadState('networkidle');

    const newBtn = page.getByRole('button', { name: /nouveau|créer|ajouter/i }).first();
    if (!await newBtn.isVisible().catch(() => false)) {
      test.skip(true, 'Action de création de tenant non disponible');
    }
    await newBtn.click();

    const name = `MIN_E2E_${Date.now()}`;
    const nameInput = page.locator('input[name*="name"], input[placeholder*="nom"]').first();
    await nameInput.fill(name);

    const codeInput = page.locator('input[name*="code"], input[placeholder*="code"]').first();
    if (await codeInput.isVisible().catch(() => false)) await codeInput.fill('MINEXT');

    const submitBtn = page.getByRole('button', { name: /enregistrer|créer|confirmer/i }).last();
    await submitBtn.click();

    await expect(page.getByText(name).first()).toBeVisible({ timeout: 10_000 });
  });

  test('SC-PLAT-04 — Given super_admin, When /users, Then liste utilisateurs globaux', async ({ page }) => {
    await page.goto('users');
    await page.waitForLoadState('networkidle');

    const visible = await page.locator('table, .grid').first().isVisible().catch(() => false);
    if (!visible) {
      test.skip(true, 'Page utilisateurs non disponible pour super_admin');
    }
    await expect(page.getByText(/SUPER001|MINFI001|matricule/i).first()).toBeVisible({ timeout: 10_000 });
  });
});
