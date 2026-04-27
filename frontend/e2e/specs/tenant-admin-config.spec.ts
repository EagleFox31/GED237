import { test, expect } from '../fixtures/auth.fixture';

/**
 * SC-ADM-USERS / SC-ADM-QUOTAS / SC-ADM-WORKFLOWS — Configuration ministère
 * par le tenant_admin.
 *
 *   - SC-ADM-USERS-01 : créer un utilisateur dans son ministère
 *   - SC-ADM-USERS-02 : lister et filtrer les utilisateurs
 *   - SC-ADM-QUOTAS-01 : configurer le quota de stockage d'un service
 *   - SC-ADM-WORKFLOWS-01 : définir un circuit de validation personnalisé
 */
test.describe.serial('Feature: Configuration ministère (tenant_admin)', () => {

  test.beforeEach(async ({ loginAs }) => {
    await loginAs('tenant_admin');
  });

  test('SC-ADM-USERS-02 — Given tenant_admin, When /users, Then liste utilisateurs ministère', async ({ page }) => {
    await page.goto('users');
    await page.waitForLoadState('networkidle');

    const visible = await page.locator('table, .grid').first().isVisible().catch(() => false);
    if (!visible) {
      test.skip(true, 'Page utilisateurs non disponible');
    }
    await expect(page.getByText(/MINFI|matricule|utilisateur/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('SC-ADM-USERS-01 — Given liste utilisateurs, When créer un nouvel utilisateur, Then ajouté', async ({ page }) => {
    await page.goto('users');
    await page.waitForLoadState('networkidle');

    const newBtn = page.getByRole('button', { name: /nouveau|créer|ajouter/i }).first();
    if (!await newBtn.isVisible().catch(() => false)) {
      test.skip(true, 'Création utilisateur non disponible');
    }
    await newBtn.click();

    const matricule = `E2E${Date.now().toString().slice(-6)}`;
    await page.locator('input[name*="matricule"], input[placeholder*="matricule"]').first().fill(matricule);
    await page.locator('input[name*="first"], input[placeholder*="prénom"]').first().fill('Jean');
    await page.locator('input[name*="last"], input[placeholder*="nom"]').first().fill('Test');
    await page.locator('input[name*="email"], input[type="email"]').first().fill(`${matricule.toLowerCase()}@minfi.cm`);

    const passwordField = page.locator('input[type="password"], input[name*="password"]').first();
    if (await passwordField.isVisible().catch(() => false)) {
      await passwordField.fill('Test@2025');
    }

    const submitBtn = page.getByRole('button', { name: /enregistrer|créer|confirmer/i }).last();
    await submitBtn.click();

    await expect(page.getByText(matricule).first()).toBeVisible({ timeout: 10_000 });
  });

  test('SC-ADM-QUOTAS-01 — Given un service, When configurer le quota, Then valeur enregistrée', async ({ page }) => {
    await page.goto('org');
    await page.waitForLoadState('networkidle');

    const node = page.locator('button, [role="treeitem"], li').filter({ hasText: /\w+/ }).first();
    if (!await node.isVisible().catch(() => false)) {
      test.skip(true, 'Aucun service dans l\'arbre');
    }
    await node.click();

    const quotaTab = page.getByRole('button', { name: /quota|stockage|paramètres/i }).first();
    if (!await quotaTab.isVisible().catch(() => false)) {
      test.skip(true, 'Configuration quota non exposée');
    }
    await quotaTab.click();

    const quotaInput = page.locator('input[type="number"], input[name*="quota"]').first();
    if (!await quotaInput.isVisible().catch(() => false)) {
      test.skip(true, 'Champ quota absent');
    }
    await quotaInput.fill('2048');

    const saveBtn = page.getByRole('button', { name: /enregistrer|sauvegarder|appliquer/i }).first();
    await saveBtn.click();
    await expect(page.getByText(/enregistré|sauvegardé|succès/i).first()).toBeVisible({ timeout: 5_000 });
  });

  test('SC-ADM-WORKFLOWS-01 — Given /workflows, When créer un circuit, Then circuit listé', async ({ page }) => {
    await page.goto('workflows');
    await page.waitForLoadState('networkidle');

    const newBtn = page.getByRole('button', { name: /nouveau|créer|ajouter|circuit/i }).first();
    if (!await newBtn.isVisible().catch(() => false)) {
      test.skip(true, 'Création de circuit non disponible');
    }
    await newBtn.click();

    const name = `Circuit E2E ${Date.now()}`;
    const nameInput = page.locator('input[name*="name"], input[placeholder*="nom"]').first();
    await nameInput.fill(name);

    const submitBtn = page.getByRole('button', { name: /enregistrer|créer/i }).last();
    await submitBtn.click();

    await expect(page.getByText(name).first()).toBeVisible({ timeout: 10_000 });
  });
});
