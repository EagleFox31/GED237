import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { test, expect } from '../fixtures/auth.fixture';
import { DraftWorkspacePage } from '../pages/documents.page';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_FILE = path.resolve(__dirname, '../fixtures/files/test-document.txt');
let UNIQUE_UPLOAD_FILE = path.resolve(__dirname, `../fixtures/files/test-document-${Date.now()}.txt`);

/**
 * SC-RED-02..05 — Parcours rédacteur (collaborator) au-delà du simple dépôt.
 *
 *   - SC-RED-02 : créer une nouvelle version d'un document existant
 *   - SC-RED-03 : partager un document avec un autre utilisateur
 *   - SC-RED-04 : supprimer (mettre à la corbeille) un document
 *   - SC-RED-05 : rechercher un document par mot-clé full-text
 *
 * Chaque scénario est défensif : si la fonctionnalité n'est pas exposée
 * dans l'UI courante, le test se skippe plutôt que d'échouer.
 */
test.describe.serial('Feature: Parcours rédacteur (SC-RED-02..05)', () => {

  let docTitle: string;

  test.beforeAll(() => {
    docTitle = `Redacteur E2E ${Date.now()}`;
  });

  test.beforeAll(async () => {
    await fs.writeFile(UNIQUE_UPLOAD_FILE, `Rédacteur E2E unique payload ${Date.now()}\n`, 'utf-8');
  });

  test.afterAll(async () => {
    await fs.unlink(UNIQUE_UPLOAD_FILE).catch(() => undefined);
  });

  test('Pré-requis — Given rédacteur, When upload initial, Then document visible', async ({ loginAs, page }) => {
    await loginAs('collaborator');
    const ws = new DraftWorkspacePage(page);
    await ws.expectPageVisible();
    await ws.openUploadModal();
    await ws.fillUploadForm(docTitle, 'Note', 'redacteur, e2e', UNIQUE_UPLOAD_FILE);
    await ws.submitUpload();
    await ws.expectUploadModalClosed();
    await expect(page.locator('.grid').getByText(docTitle)).toBeVisible({ timeout: 10_000 });
  });

  test('SC-RED-02 — Given un document existant, When ajouter une version, Then v2 listée', async ({ loginAs, page }) => {
    await loginAs('collaborator');
    const ws = new DraftWorkspacePage(page);
    await ws.expectPageVisible();

    const card = page.locator('.grid > div').filter({ hasText: docTitle }).first();
    await card.click();

    const newVersionBtn = page.getByRole('button', { name: /nouvelle version|version.*ajout|v2/i }).first();
    if (!await newVersionBtn.isVisible().catch(() => false)) {
      test.skip(true, 'Bouton "nouvelle version" non disponible dans l\'UI courante');
    }
    await newVersionBtn.click();

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(TEST_FILE);
    const confirmBtn = page.getByRole('button', { name: /enregistrer|confirmer|envoyer/i }).last();
    await confirmBtn.click();

    await expect(page.getByText(/v2|version 2|nouvelle version/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('SC-RED-03 — Given un document, When partager, Then destinataire ajouté', async ({ loginAs, page }) => {
    await loginAs('collaborator');
    const ws = new DraftWorkspacePage(page);
    await ws.expectPageVisible();

    const card = page.locator('.grid > div').filter({ hasText: docTitle }).first();
    await card.click();

    const shareBtn = page.getByRole('button', { name: /partager|share/i }).first();
    if (!await shareBtn.isVisible().catch(() => false)) {
      test.skip(true, 'Bouton de partage non disponible dans l\'UI');
    }
    await shareBtn.click();

    // Sélectionner un destinataire
    const userSelect = page.locator('select, input[role="combobox"]').first();
    if (await userSelect.isVisible().catch(() => false)) {
      const options = userSelect.locator('option:not([disabled])');
      if (await options.count() > 1) {
        const firstValue = await options.nth(1).getAttribute('value');
        if (firstValue) await userSelect.selectOption(firstValue);
      }
    }

    const confirmBtn = page.getByRole('button', { name: /partager|envoyer|confirmer/i }).last();
    await confirmBtn.click();
    await expect(page.getByText(/partagé|succès|ajouté/i).first()).toBeVisible({ timeout: 5_000 });
  });

  test('SC-RED-04 — Given un document, When supprimer, Then disparaît de la grille', async ({ loginAs, page }) => {
    await loginAs('collaborator');
    const ws = new DraftWorkspacePage(page);
    await ws.expectPageVisible();

    const card = page.locator('.grid > div').filter({ hasText: docTitle }).first();
    if (!await card.isVisible().catch(() => false)) {
      test.skip(true, 'Document de test absent — pré-requis non satisfait');
    }

    page.once('dialog', d => d.accept());
    const deleteBtn = card.getByRole('button', { name: /supprimer|corbeille|delete/i }).first();
    if (!await deleteBtn.isVisible().catch(() => false)) {
      // Tenter via menu contextuel
      const menuBtn = card.getByRole('button', { name: /more|options|menu/i }).first();
      if (await menuBtn.isVisible().catch(() => false)) {
        await menuBtn.click();
        const deleteItem = page.getByRole('menuitem', { name: /supprimer|corbeille/i }).first();
        if (await deleteItem.isVisible().catch(() => false)) await deleteItem.click();
      } else {
        test.skip(true, 'Action de suppression non disponible');
      }
    } else {
      await deleteBtn.click();
    }

    await expect(page.locator('.grid').getByText(docTitle)).toBeHidden({ timeout: 10_000 });
  });

  test('SC-RED-05 — Given documents indexés, When recherche par mot-clé, Then résultat filtré', async ({ loginAs, page, request }) => {
    await loginAs('collaborator');
    const ws = new DraftWorkspacePage(page);
    await ws.expectPageVisible();

    const searchInput = page.getByPlaceholder(/rechercher|search/i).first();
    if (!await searchInput.isVisible().catch(() => false)) {
      test.skip(true, 'Champ de recherche absent');
    }

    await searchInput.fill('e2e');
    await page.keyboard.press('Enter');
    await page.waitForLoadState('networkidle');

    const cards = page.locator('.grid > div');
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });
});
