import { test, expect } from '../../fixtures/uat.fixture';

/**
 * Clic droit étendu de l'explorateur (/spaces) : sur un dossier, sur le fond, au clavier (touche Menu, Maj+F10).
 * Seed : MINFI001 (tenant_admin) voit le Cabinet du Ministre et ses sous-services (SG, DRH, DAF, DSI).
 */
test.describe('Explorateur — clic droit étendu', () => {
  test('clic droit sur un dossier : Ouvrir et Copier le chemin', async ({ page, loginAs }) => {
    await loginAs('tenant_admin');
    await page.goto('spaces');

    const folder = page.getByRole('button', { name: /Direction des Affaires Financieres/ }).first();
    await folder.click({ button: 'right' });
    const menu = page.getByRole('menu');
    await expect(menu.getByRole('menuitem', { name: 'Copier le chemin' })).toBeVisible();
    await menu.getByRole('menuitem', { name: 'Ouvrir' }).click();
    await expect(page.getByRole('button', { name: /^Retour vers/ })).toBeVisible();
  });

  test('clic droit sur le fond : Actualiser relance le chargement', async ({ page, loginAs }) => {
    await loginAs('tenant_admin');
    await page.goto('spaces');
    await expect(page.locator('[data-explorer-item]').first()).toBeVisible();

    const reload = page.waitForRequest((r) => r.url().includes('/spaces/documents'));
    await page.getByLabel('Contenu du dossier').click({ button: 'right', position: { x: 4, y: 4 } });
    await page.getByRole('menuitem', { name: 'Actualiser' }).click();
    await reload;
  });

  test('clavier seul : touche Menu et Maj+F10 ouvrent le même menu, Échap rend le focus', async ({
    page,
    loginAs,
  }) => {
    await loginAs('tenant_admin');
    await page.goto('spaces');

    const folder = page.locator('[data-explorer-item]').first();
    await folder.focus();

    await page.keyboard.press('ContextMenu');
    const menu = page.getByRole('menu');
    await expect(menu.getByRole('menuitem', { name: 'Copier le chemin' })).toBeVisible();
    await expect(menu.getByRole('menuitem').first()).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
    await expect(folder).toBeFocused();

    await page.keyboard.press('Shift+F10');
    await expect(menu.getByRole('menuitem', { name: 'Copier le chemin' })).toBeVisible();
    await page.keyboard.press('ArrowDown');
    await expect(menu.getByRole('menuitem', { name: 'Copier le chemin' })).toBeFocused();
    await page.keyboard.press('Escape');
  });

  test('hors de l’explorateur, le menu du navigateur n’est pas intercepté', async ({ page, loginAs }) => {
    await loginAs('tenant_admin');
    await page.goto('spaces');
    await expect(page.locator('[data-explorer-item]').first()).toBeVisible();

    await page.getByRole('navigation').first().click({ button: 'right', position: { x: 4, y: 4 } });
    await expect(page.getByRole('menu')).toHaveCount(0);
  });
});
