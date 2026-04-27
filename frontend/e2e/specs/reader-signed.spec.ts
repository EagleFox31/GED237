import { test, expect } from '../fixtures/auth.fixture';

/**
 * SC-LEC-02 — Le lecteur consulte un document signé sans pouvoir le modifier.
 *
 * Étapes :
 *   1. login reader
 *   2. ouvrir /documents
 *   3. cliquer un document (signé idéalement)
 *   4. vérifier qu'aucun bouton d'édition/suppression/upload n'est présent
 *   5. vérifier que les métadonnées et le contenu sont consultables
 */
test.describe('Feature: Lecteur consulte document signé (SC-LEC-02)', () => {

  test('Given reader sur /documents, When ouvrir un doc, Then consultation seule', async ({ loginAs, page }) => {
    await loginAs('reader');
    await page.goto('documents');
    await page.waitForLoadState('networkidle');

    const card = page.locator('.grid > div').first();
    if (!await card.isVisible().catch(() => false)) {
      test.skip(true, 'Aucun document accessible au lecteur');
    }
    await card.click();

    // Modal détail doit s'ouvrir
    const modal = page.locator('[role="dialog"], .modal, [class*="fixed inset-0"]').first();
    await expect(modal).toBeVisible({ timeout: 10_000 });

    // Aucune action de modification disponible
    const editBtn = await modal.getByRole('button', { name: /modifier|éditer|edit/i }).first().isVisible().catch(() => false);
    const deleteBtn = await modal.getByRole('button', { name: /supprimer|corbeille|delete/i }).first().isVisible().catch(() => false);
    const newVersionBtn = await modal.getByRole('button', { name: /nouvelle version|upload/i }).first().isVisible().catch(() => false);
    const signBtn = await modal.getByRole('button', { name: /signer|valider|approuver/i }).first().isVisible().catch(() => false);

    expect(editBtn).toBeFalsy();
    expect(deleteBtn).toBeFalsy();
    expect(newVersionBtn).toBeFalsy();
    expect(signBtn).toBeFalsy();

    // Métadonnées consultables
    const infoVisible = await modal.getByText(/titre|date|auteur|version|statut/i).first().isVisible().catch(() => false);
    expect(infoVisible).toBeTruthy();
  });

  test('Given reader, When tentative POST /documents/upload, Then 403', async ({ loginAs, page, request }) => {
    await loginAs('reader');
    const token = await page.evaluate(() => sessionStorage.getItem('access_token'));
    expect(token).toBeTruthy();

    const API = process.env.VITE_API_URL || 'http://localhost:8000/api/v1';
    const res = await request.post(`${API}/documents/upload`, {
      headers: { Authorization: `Bearer ${token}` },
      multipart: {
        title: 'Tentative lecteur',
        file: { name: 'x.txt', mimeType: 'text/plain', buffer: Buffer.from('x') },
      },
    });
    expect([401, 403, 405]).toContain(res.status());
  });
});
