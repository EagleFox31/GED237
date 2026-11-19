import type { Route } from '@playwright/test';
import { test, expect } from '../../fixtures/auth.fixture';

/**
 * Audit « parcours réel du fonctionnaire », friction : un agent qui reçoit cinq pièces doit ouvrir
 * cinq fois la fenêtre de dépôt. Dépôt groupé, échec partiel. Réponses simulées.
 */

const pdf = (name: string) => ({ name, mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%%EOF\n') });

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

test.describe('Dépôt de plusieurs fichiers', () => {
  test('MUP-01 — Given 3 fichiers dont 1 refusé, When Envoyer, Then 2 déposés et le refusé reste prêt à renvoyer', async ({ loginAs, page }) => {
    const sentTitles: string[] = [];
    await page.route(/\/api\/v1\/documents\/upload/, (route) => {
      const body = route.request().postDataBuffer()?.toString('latin1') ?? '';
      const title = /name="title"\r\n\r\n([^\r]*)/.exec(body)?.[1] ?? '';
      sentTitles.push(title);
      if (title === 'Facture illisible') return json(route, { detail: 'Format non pris en charge.' }, 415);
      return json(route, { id: `d-${sentTitles.length}`, title, status: 'draft' }, 201);
    });

    await loginAs('collaborator');
    await page.getByRole('button', { name: /Nouveau Document/i }).click();
    const modal = page.locator('.fixed.inset-0').filter({ hasText: 'Nouveau Document' });
    await modal.locator('input[type="file"]').setInputFiles([
      pdf('Note de service.pdf'),
      pdf('Facture illisible.pdf'),
      pdf('Bordereau.pdf'),
    ]);

    await expect(modal.getByTestId('upload-file-list').getByRole('listitem')).toHaveCount(4); // 3 fichiers + l'aide
    await expect(modal.getByTestId('upload-multi-title-hint')).toBeVisible();
    await modal.getByRole('button', { name: 'Retirer Bordereau.pdf' }).click();
    await expect(modal.getByRole('button', { name: 'Envoyer les 2' })).toBeVisible();
    await modal.getByRole('button', { name: 'Envoyer les 2' }).click();

    await expect(page.getByTestId('success-notice')).toHaveText(/Document déposé : « Note de service »\./);
    await expect(modal.locator('.bg-red-50')).toContainText('Facture illisible.pdf');
    // Le fichier refusé reste seul : formulaire d'un fichier, prêt à renvoyer.
    await expect(modal.getByText('Facture illisible.pdf', { exact: true })).toBeVisible();
    expect(sentTitles).toEqual(['Note de service', 'Facture illisible']);

    // Fermer après un dépôt partiel rafraîchit l'écran comme après un succès.
    await modal.getByRole('button', { name: /annuler/i }).click();
    await expect(modal).toHaveCount(0);
  });
});
