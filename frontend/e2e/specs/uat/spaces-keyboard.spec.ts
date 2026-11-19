import { test, expect } from '../../fixtures/uat.fixture';

/**
 * Réflexes clavier de l'explorateur (/spaces) : flèches, Entrée, Retour arrière, Ctrl+F, Échap.
 * Clavier seul : aucune souris après le premier focus.
 * Seed : MINFI001 (tenant_admin) voit le Cabinet du Ministre et ses sous-services (SG, DRH, DAF, DSI).
 */
test.describe('Explorateur — réflexes clavier', () => {
  test('flèches, Entrée et Retour arrière naviguent dans les dossiers', async ({ page, loginAs }) => {
    await loginAs('tenant_admin');
    await page.goto('spaces');

    const folders = page.locator('[data-explorer-item]');
    await expect(folders.first()).toBeVisible();
    await folders.first().focus();

    await page.keyboard.press('ArrowRight');
    await expect(folders.nth(1)).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(folders.first()).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: /^Retour vers/ })).toBeVisible();

    await page.keyboard.press('Backspace');
    await expect(page.getByRole('button', { name: /^Retour vers/ })).toHaveCount(0);
  });

  test('Ctrl+F active la recherche ; Retour arrière y efface du texte sans quitter le dossier', async ({
    page,
    loginAs,
  }) => {
    await loginAs('tenant_admin');
    await page.goto('spaces');

    const folders = page.locator('[data-explorer-item]');
    await folders.first().focus();
    await page.keyboard.press('Control+f');

    const search = page.locator('[data-global-search]');
    await expect(search).toBeFocused();
    // Frappe rapide, sans attente entre les touches (#163).
    await page.keyboard.type('ab');
    await page.keyboard.press('Backspace');
    await expect(search).toHaveValue('a');
    await expect(page.getByRole('button', { name: /^Retour vers/ })).toHaveCount(0);
  });

  test('Entrée ouvre l’aperçu d’un document, Échap le ferme et rend le focus', async ({
    page,
    loginAs,
    adminApi,
    runId,
  }) => {
    const title = `Note clavier ${runId}`;
    await adminApi.uploadDocument(`clavier-${runId}.txt`, title, `Contenu ${runId}`);

    await loginAs('tenant_admin');
    await page.goto(`spaces?q=${encodeURIComponent(runId)}`);

    const doc = page.getByLabel(new RegExp(`^${title} — `));
    await expect(doc).toBeVisible();
    await doc.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByText('Aperçu du document')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByText('Aperçu du document')).toHaveCount(0);
    await expect(doc).toBeFocused();
  });

  // #167 : en vue Détails, la ligne n'a pas d'aria-label, donc un lecteur d'écran lit chaque cellule.
  test('vue Détails : chaque cellule est lue et la ligne reste au clavier', async ({ page, loginAs, adminApi, runId }) => {
    const title = `Note tableau ${runId}`;
    await adminApi.uploadDocument(`tableau-${runId}.txt`, title, `Contenu ${runId}`);

    await loginAs('tenant_admin');
    await page.goto(`spaces?q=${encodeURIComponent(runId)}`);
    await page.getByRole('button', { name: 'Détails', exact: true }).click();

    const row = page.getByRole('row').filter({ has: page.getByRole('cell', { name: new RegExp(title) }) });
    await expect(row).toHaveCount(1);
    await expect(row).not.toHaveAttribute('aria-label');
    // Le nom de la ligne vient de ses cellules : titre, classement, taille… et non d'un libellé qui les masque.
    await expect(row.getByRole('cell')).toHaveCount(6);
    const [, , , size, updated] = (await row.getByRole('cell').allInnerTexts()).map((text) => text.trim());
    const escape = (text = '') => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    await expect(row).toHaveAccessibleName(new RegExp(`${escape(title)}.*${escape(size)}.*${escape(updated)}`));

    await row.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByText('Aperçu du document')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByText('Aperçu du document')).toHaveCount(0);
    await expect(row).toBeFocused();
  });
});
