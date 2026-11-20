import type { Page } from '@playwright/test';
import { test, expect } from '../../fixtures/uat.fixture';

/** F-NEXT-02 : « Ouvrir » demande un lien signé court et l'ouvre dans un nouvel onglet, sans jeton de session. */
test.describe('Fiche document — Ouvrir', () => {
  const ACCESS = /\/request-access$/;

  const countAccessRequests = (page: Page) => {
    const methods: string[] = [];
    page.on('request', (request) => {
      if (ACCESS.test(request.url())) methods.push(request.method());
    });
    return methods;
  };

  const openButton = (page: Page) => page.getByRole('button', { name: 'Ouvrir', exact: true });

  test('« Ouvrir » affiche le fichier dans un nouvel onglet par un lien signé', async ({ page, loginAs, adminApi, runId }) => {
    const title = `Ouvrir ${runId}`;
    const content = `Contenu ouvert ${runId}`;
    const doc = await adminApi.uploadDocument(`ouvrir-${runId}.txt`, title, content);
    const requests = countAccessRequests(page);

    await loginAs('tenant_admin');
    await page.goto(`documents?open=${doc.id}`);
    await expect(page.getByRole('button', { name: 'Quitter la fiche' })).toBeVisible();

    const popupPromise = page.waitForEvent('popup');
    await openButton(page).click();
    const popup = await popupPromise;
    await popup.waitForURL(/\/api\/v1\/documents\/stream\/[^/?]+$/);

    // Le nouvel onglet lit le fichier sans Authorization et n'a pas accès à l'application.
    await expect(popup.locator('body')).toContainText(content);
    expect(await popup.evaluate(() => window.opener)).toBeNull();
    expect(requests).toEqual(['POST']);
    await expect(openButton(page)).toBeEnabled();
  });

  test('deux clics rapides : une seule demande, un seul onglet', async ({ page, loginAs, adminApi, runId }) => {
    const doc = await adminApi.uploadDocument(`double-${runId}.txt`, `Double ${runId}`, `Double ${runId}`);
    const requests = countAccessRequests(page);
    await page.route(ACCESS, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.continue();
    });
    const popups: Page[] = [];
    page.context().on('page', (opened) => popups.push(opened));

    await loginAs('tenant_admin');
    await page.goto(`documents?open=${doc.id}`);
    await expect(page.getByRole('button', { name: 'Quitter la fiche' })).toBeVisible();

    // Deux clics dans la même tâche, avant que React ait pu désactiver le bouton.
    await openButton(page).evaluate((button: HTMLElement) => {
      button.click();
      button.click();
    });
    await expect.poll(() => popups.length).toBe(1);
    const [popup] = popups;
    if (!popup) throw new Error('aucun onglet ouvert');
    await popup.waitForURL(/\/documents\/stream\//);
    await expect(openButton(page)).toBeEnabled();
    expect(requests).toEqual(['POST']);
    expect(popups).toHaveLength(1);
  });

  for (const { status, message } of [
    { status: 404, message: 'Ce document ne peut pas être ouvert.' },
    { status: 429, message: 'Trop d’ouvertures en peu de temps. Réessayez dans une minute.' },
  ]) {
    test(`lien refusé (${status}) : l’onglet vide est refermé et le message s’affiche`, async ({ page, loginAs, adminApi, runId }) => {
      const doc = await adminApi.uploadDocument(`refus-${status}-${runId}.txt`, `Refus ${runId}`, `Refus ${runId}`);
      await page.route(ACCESS, (route) => route.fulfill({ status, json: { detail: 'Refused' } }));

      await loginAs('tenant_admin');
      await page.goto(`documents?open=${doc.id}`);
      await expect(page.getByRole('button', { name: 'Quitter la fiche' })).toBeVisible();

      const popupPromise = page.waitForEvent('popup');
      await openButton(page).click();
      const popup = await popupPromise;
      await expect.poll(() => popup.isClosed()).toBe(true);
      await expect(page.getByText(message)).toBeVisible();
    });
  }

  test('lien hors de l’API : rien n’est ouvert et le message s’affiche', async ({ page, loginAs, adminApi, runId }) => {
    const doc = await adminApi.uploadDocument(`ailleurs-${runId}.txt`, `Ailleurs ${runId}`, `Ailleurs ${runId}`);
    await page.route(ACCESS, (route) =>
      route.fulfill({ status: 200, json: { url: 'https://ailleurs.example/x', expires_at: '2026-11-20T12:00:00Z', expires_in: 60 } }),
    );

    await loginAs('tenant_admin');
    await page.goto(`documents?open=${doc.id}`);
    await expect(page.getByRole('button', { name: 'Quitter la fiche' })).toBeVisible();

    const popupPromise = page.waitForEvent('popup');
    await openButton(page).click();
    const popup = await popupPromise;
    await expect.poll(() => popup.isClosed()).toBe(true);
    await expect(page.getByText('Lien d’ouverture invalide.')).toBeVisible();
  });

  test('fenêtres bloquées : le message demande de les autoriser', async ({ page, loginAs, adminApi, runId }) => {
    const doc = await adminApi.uploadDocument(`bloque-${runId}.txt`, `Bloqué ${runId}`, `Bloqué ${runId}`);
    const requests = countAccessRequests(page);
    // Bloqueur de fenêtres : window.open renvoie null, pendant le clic comme après.
    await page.addInitScript(() => {
      window.open = () => null;
    });

    await loginAs('tenant_admin');
    await page.goto(`documents?open=${doc.id}`);
    await expect(page.getByRole('button', { name: 'Quitter la fiche' })).toBeVisible();

    await openButton(page).click();
    await expect(page.getByText('Autorisez les fenêtres pour ce site, puis réessayez.')).toBeVisible();
    expect(requests).toEqual(['POST']);
  });
});
