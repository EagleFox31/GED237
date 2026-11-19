import { test, expect } from '../fixtures/auth.fixture';
import { DraftWorkspacePage } from '../pages/documents.page';

/**
 * Dépôt sans réseau (audit UX lot 6, point 4) : un seul message, jamais deux, et la saisie reste.
 * - UPLOAD-OFF-01 : coupure pendant l'envoi → bandeau global seul, rien en double dans la fenêtre.
 * - UPLOAD-OFF-02 : poste déjà hors ligne → message dans la fenêtre seul, aucun envoi tenté.
 */
const file = () => ({
  name: `hors-ligne-${Date.now()}.txt`,
  mimeType: 'text/plain',
  buffer: Buffer.from(`Dépôt hors ligne ${Date.now()}\n`),
});

test.describe('Dépôt sans réseau', () => {
  test.beforeEach(async ({ loginAs }) => loginAs('collaborator'));

  test('UPLOAD-OFF-01 : coupure pendant l’envoi → un seul message, saisie gardée', async ({ page }) => {
    const ws = new DraftWorkspacePage(page);
    await ws.openUploadModal();
    const title = `Hors ligne ${Date.now()}`;
    await ws.fillUploadForm(title, 'Note', 'reseau', file());

    await page.route('**/documents/upload', (route) => route.abort('internetdisconnected'));
    await ws.submitUpload();

    await expect(page.getByText(/serveur est injoignable/).first()).toBeVisible();
    await expect(ws.uploadModal).toBeVisible();
    await expect(ws.uploadModal.getByText(/envoi a échoué/)).toHaveCount(0);
    await expect(ws.titleInput).toHaveValue(title);
  });

  test('UPLOAD-OFF-02 : poste hors ligne → message dans la fenêtre, aucun envoi', async ({ page, context }) => {
    const ws = new DraftWorkspacePage(page);
    await ws.openUploadModal();
    await ws.fillUploadForm(`Hors ligne ${Date.now()}`, 'Note', 'reseau', file());

    let sent = false;
    page.on('request', (r) => { if (r.url().includes('/documents/upload')) sent = true; });
    await context.setOffline(true);
    try {
      await ws.submitUpload();
      await expect(ws.uploadModal.getByText('Vous êtes hors ligne. Votre saisie est gardée : renvoyez dès le retour du réseau.')).toBeVisible();
      await expect(page.getByText(/serveur est injoignable/)).toHaveCount(0);
      expect(sent).toBe(false);
    } finally {
      await context.setOffline(false);
    }
  });
});
