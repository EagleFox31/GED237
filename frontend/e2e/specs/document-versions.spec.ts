import type { APIRequestContext, Page, TestInfo } from '@playwright/test';

import { test, expect } from '../fixtures/auth.fixture';
import { UatApi } from '../fixtures/uat.fixture';
import { DocumentDetailModal } from '../pages/document-detail.page';

const runIdOf = (info: TestInfo) => `${Date.now().toString(36)}${info.workerIndex}${info.retry}`;

/** API helper on the session opened by loginAs (no extra 2FA login). */
async function sessionApi(page: Page, request: APIRequestContext): Promise<UatApi> {
  const token = await page.evaluate(() => sessionStorage.getItem('access_token'));
  if (!token) throw new Error('access_token absent from sessionStorage after loginAs');
  return new UatApi(request, token);
}

test.describe('Nouvelle version depuis la fiche (#275)', () => {
  /**
   * SCENARIO: déposer une nouvelle version, puis refuser un fichier identique
   *
   *   GIVEN  un document déposé par l'admin
   *   WHEN   il ouvre l'historique, choisit un autre fichier, écrit une note et envoie
   *   THEN   « Version N ajoutée. », la nouvelle version est « Actuelle » avec la note
   *   WHEN   il renvoie le même fichier
   *   THEN   « Ce fichier est identique à la version actuelle. » (message choisi par le code, pas le texte serveur)
   */
  test('Given doc, When nouvelle version puis même fichier, Then version ajoutée puis doublon refusé', async ({ page, request, loginAs }) => {
    const runId = runIdOf(test.info());
    const title = `Nouvelle version 275 ${runId}`;
    const detail = new DocumentDetailModal(page);
    const form = page.getByTestId('document-new-version');
    const fileInput = form.getByLabel('Fichier de la nouvelle version');
    const newContent = { name: `v2-${runId}.txt`, mimeType: 'text/plain', buffer: Buffer.from(`Version 2 ${runId}`) };

    // GIVEN
    await loginAs('tenant_admin');
    const admin = await sessionApi(page, request);
    const doc = await admin.uploadDocument(`v1-${runId}.txt`, title, `Version 1 ${runId}`);

    // WHEN
    await page.goto(`documents?open=${doc.id}`);
    await detail.expectOpenOn(title);
    await detail.switchToHistoryTab();
    await fileInput.setInputFiles(newContent);
    await form.getByLabel('Ce qui change').fill(`Note ${runId}`);
    await form.getByRole('button', { name: 'Envoyer' }).click();

    // THEN
    await expect(form.getByRole('status')).toHaveText(/^Version \d+ ajoutée\.$/, { timeout: 15_000 });
    const versions = page.getByTestId('document-version');
    await expect(versions).toHaveCount(2);
    await expect(versions.filter({ hasText: 'Actuelle' })).toContainText(`Note ${runId}`);

    // WHEN — same file again
    await fileInput.setInputFiles(newContent);
    await form.getByRole('button', { name: 'Envoyer' }).click();

    // THEN
    await expect(form.getByRole('alert')).toHaveText('Ce fichier est identique à la version actuelle.', { timeout: 15_000 });
    await expect(versions).toHaveCount(2);
  });
});
