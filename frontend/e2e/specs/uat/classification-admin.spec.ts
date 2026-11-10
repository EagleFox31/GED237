import { test, expect } from '../../fixtures/uat.fixture';
import { RulesPage } from '../../pages/rules.page';

/**
 * V1.1 lot 2 — export / import des règles de classement (écran Automates & Règles).
 * L'import passe par une simulation : le dialogue annonce « n à créer, n à mettre à jour,
 * n identiques, n rejetées » ; rien n'est écrit tant que l'utilisateur ne confirme pas.
 */
test.describe('Règles de classement — export / import (V1.1 lot 2)', () => {
  test('réimporter son propre export annonce des règles identiques, sans rien à confirmer', async ({ page, loginAs }) => {
    await loginAs('tenant_admin');
    const rulesPage = new RulesPage(page);
    await rulesPage.goto();
    await rulesPage.openRulesTab();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exporter' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.json$/);
    const path = await download.path();

    await page.getByLabel('Fichier de règles à importer').setInputFiles(path);

    const dialog = page.getByRole('dialog', { name: 'Importer les règles' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(/0 à créer, 0 à mettre à jour, \d+ identiques, 0 rejetées/);
    await expect(dialog.getByRole('button', { name: 'Confirmer' })).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Fermer' }).click();
    await expect(dialog).toHaveCount(0);
  });

  test('un fichier qui n’est pas un export de règles est refusé sans dialogue d’import', async ({ page, loginAs }) => {
    await loginAs('tenant_admin');
    const rulesPage = new RulesPage(page);
    await rulesPage.goto();
    await rulesPage.openRulesTab();

    await page.getByLabel('Fichier de règles à importer').setInputFiles({
      name: 'nimporte-quoi.json',
      mimeType: 'application/json',
      buffer: Buffer.from('pas du json'),
    });
    await expect(page.getByRole('dialog', { name: 'Importer les règles' })).toHaveCount(0);
  });
});
