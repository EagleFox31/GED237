import type { APIRequestContext, Page, TestInfo } from '@playwright/test';

import { test, expect } from '../fixtures/auth.fixture';
import { UatApi } from '../fixtures/uat.fixture';
import { DocumentDetailModal } from '../pages/document-detail.page';

const runIdOf = (info: TestInfo) => `${Date.now().toString(36)}${info.workerIndex}${info.retry}`;

async function sessionApi(page: Page, request: APIRequestContext): Promise<UatApi> {
  const token = await page.evaluate(() => sessionStorage.getItem('access_token'));
  if (!token) throw new Error('access_token absent from sessionStorage after loginAs');
  return new UatApi(request, token);
}

test.describe('Comparer deux versions (V1.2, élément 8)', () => {
  /**
   * SCENARIO: voir ce qui a changé entre deux versions
   *
   *   GIVEN  un document avec deux versions de contenu et de taille différents
   *   WHEN   l'agent ouvre l'historique et coche les deux versions
   *   THEN   le panneau dit que le fichier a changé, la taille et la note changent, l'auteur reste inchangé
   *   WHEN   il décoche une version
   *   THEN   le panneau se ferme
   */
  test('Given 2 versions, When on coche les deux, Then le panneau montre ce qui a changé', async ({ page, request, loginAs }) => {
    const runId = runIdOf(test.info());
    const title = `Comparer versions ${runId}`;
    const detail = new DocumentDetailModal(page);
    const form = page.getByTestId('document-new-version');
    const picks = page.getByTestId('version-compare-pick');

    // GIVEN
    await loginAs('tenant_admin');
    const admin = await sessionApi(page, request);
    const doc = await admin.uploadDocument(`cmp-${runId}.txt`, title, `Version 1 ${runId}`);
    await page.goto(`documents?open=${doc.id}`);
    await detail.expectOpenOn(title);
    await detail.switchToHistoryTab();
    await form.getByLabel('Fichier de la nouvelle version').setInputFiles({
      name: `cmp2-${runId}.txt`, mimeType: 'text/plain', buffer: Buffer.from(`Version 2 plus longue ${runId} ${'x'.repeat(2000)}`),
    });
    await form.getByLabel('Ce qui change').fill(`Note ${runId}`);
    await form.getByRole('button', { name: 'Envoyer' }).click();
    await expect(form.getByRole('status')).toHaveText(/^Version \d+\.\d+ ajoutée\.$/, { timeout: 15_000 });
    await expect(page.getByTestId('document-version')).toHaveCount(2);

    // WHEN
    await expect(page.getByTestId('version-compare')).toHaveCount(0);
    await picks.nth(0).check();
    await picks.nth(1).check();

    // THEN
    const panel = page.getByTestId('version-compare');
    await expect(panel).toBeVisible();
    await expect(page.getByTestId('version-compare-summary')).toHaveText('Le fichier a changé entre les deux versions.');
    await expect(panel.getByTestId('version-compare-size')).toHaveAttribute('data-changed', 'true');
    await expect(panel.getByTestId('version-compare-note')).toHaveAttribute('data-changed', 'true');
    await expect(panel.getByTestId('version-compare-note')).toContainText(`Note ${runId}`);
    await expect(panel.getByTestId('version-compare-author')).toHaveAttribute('data-changed', 'false');

    // WHEN — on décoche
    await picks.nth(0).uncheck();

    // THEN
    await expect(panel).toHaveCount(0);
  });
});
