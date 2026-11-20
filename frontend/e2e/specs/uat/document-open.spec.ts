import { test, expect } from '../../fixtures/uat.fixture';

/** F-NEXT-02 : « Ouvrir » demande un lien signé court et l'ouvre dans un nouvel onglet, sans jeton de session. */
test.describe('Fiche document — Ouvrir', () => {
  test('« Ouvrir » affiche le fichier dans un nouvel onglet par un lien signé', async ({ page, loginAs, adminApi, runId }) => {
    const title = `Ouvrir ${runId}`;
    const content = `Contenu ouvert ${runId}`;
    const doc = await adminApi.uploadDocument(`ouvrir-${runId}.txt`, title, content);

    const requests: string[] = [];
    page.on('request', (request) => {
      if (/\/request-access$/.test(request.url())) requests.push(request.method());
    });

    await loginAs('tenant_admin');
    await page.goto(`documents?open=${doc.id}`);
    await expect(page.getByRole('button', { name: 'Quitter la fiche' })).toBeVisible();

    const popupPromise = page.waitForEvent('popup');
    await page.getByRole('button', { name: 'Ouvrir', exact: true }).click();
    const popup = await popupPromise;
    await popup.waitForURL(/\/api\/v1\/documents\/stream\/[^/?]+$/);

    // Le nouvel onglet lit le fichier sans Authorization et n'a pas accès à l'application.
    await expect(popup.locator('body')).toContainText(content);
    expect(await popup.evaluate(() => window.opener)).toBeNull();
    expect(requests).toEqual(['POST']);
    await expect(page.getByRole('button', { name: 'Ouvrir', exact: true })).toBeEnabled();
  });

  test('lien refusé : l’onglet vide est refermé et le message s’affiche', async ({ page, loginAs, adminApi, runId }) => {
    const doc = await adminApi.uploadDocument(`refus-${runId}.txt`, `Refus ${runId}`, `Refus ${runId}`);
    await page.route(/\/request-access$/, (route) => route.fulfill({ status: 404, json: { detail: 'Document not found' } }));

    await loginAs('tenant_admin');
    await page.goto(`documents?open=${doc.id}`);
    await expect(page.getByRole('button', { name: 'Quitter la fiche' })).toBeVisible();

    const popupPromise = page.waitForEvent('popup');
    await page.getByRole('button', { name: 'Ouvrir', exact: true }).click();
    const popup = await popupPromise;
    await expect.poll(() => popup.isClosed()).toBe(true);
    await expect(page.getByText('Ce document ne peut pas être ouvert.')).toBeVisible();
  });
});
