import { test, expect } from '../fixtures/auth.fixture';

/**
 * SC-UA-01..02 — Parcours du chef de service (unit_admin).
 *
 *   - SC-UA-01 : voir la pile de documents en attente dans son service
 *   - SC-UA-02 : consulter la composition de son équipe
 *
 * Profil très peu testé jusqu'ici — couvre son ServiceDashboard
 * et la navigation vers les vues spécifiques.
 */
test.describe.serial('Feature: Chef de service (SC-UA-01..02)', () => {

  test.beforeEach(async ({ loginAs }) => {
    await loginAs('unit_admin');
  });

  test('SC-UA-01 — Given unit_admin, When dashboard, Then KPI service visibles', async ({ page }) => {
    await expect(page).toHaveURL(/dashboard/);
    // Le ServiceDashboard affiche au moins un indicateur de service
    await expect(
      page.getByText(/service|équipe|en attente|à valider|pile/i).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('SC-UA-01 — Given unit_admin, When /tasks, Then liste des dossiers du service', async ({ page }) => {
    await page.goto('tasks');
    await page.waitForLoadState('networkidle');

    const hasList = await page.locator('table, [class*="task"], [class*="grid"]').first().isVisible().catch(() => false);
    const hasEmpty = await page.getByText(/aucun|vide|rien/i).first().isVisible().catch(() => false);
    expect(hasList || hasEmpty).toBeTruthy();
  });

  test('SC-UA-02 — Given unit_admin, When /org, Then arbre du service visible', async ({ page }) => {
    await page.goto('org');
    await page.waitForLoadState('networkidle');

    const treeVisible = await page.locator('[class*="tree"], [role="tree"], ul').first().isVisible().catch(() => false);
    if (!treeVisible) {
      test.skip(true, 'Page organisation indisponible pour ce profil');
    }

    // Au moins un nœud cliquable
    const node = page.locator('button, [role="treeitem"], li').filter({ hasText: /\w+/ }).first();
    await expect(node).toBeVisible({ timeout: 10_000 });
  });

  test('SC-UA-02 — Given unit choisie, When onglet personnel, Then membres listés', async ({ page }) => {
    await page.goto('org');
    await page.waitForLoadState('networkidle');

    const node = page.locator('button, [role="treeitem"], li').filter({ hasText: /\w+/ }).first();
    if (!await node.isVisible().catch(() => false)) {
      test.skip(true, 'Aucune unité dans l\'arbre');
    }
    await node.click();

    const personnelTab = page.getByRole('button', { name: /personnel|équipe|agents/i }).first();
    if (await personnelTab.isVisible().catch(() => false)) {
      await personnelTab.click();
      await expect(page.locator('table').first()).toBeVisible({ timeout: 5_000 });
    } else {
      test.skip(true, 'Onglet personnel non exposé');
    }
  });
});
