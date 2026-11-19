import type { APIRequestContext } from '@playwright/test';

import { test, expect, API_URL } from '../../fixtures/uat.fixture';

/** Favoris, récents, partagés (#165). Le document est créé et mis en favori par l'API. */
async function favoriteDocument(request: APIRequestContext, token: string, title: string) {
  const headers = { Authorization: `Bearer ${token}` };
  const res = await request.post(`${API_URL}/documents/upload`, {
    headers,
    multipart: { title, file: { name: `${title}.txt`, mimeType: 'text/plain', buffer: Buffer.from(title, 'utf-8') } },
  });
  expect(res.ok(), `upload ${title}`).toBeTruthy();
  const { id } = (await res.json()) as { id: string };
  expect((await request.put(`${API_URL}/me/favorites/${id}`, { headers })).status(), 'favori').toBe(204);
  return id;
}

test.describe('Favoris & récents', () => {
  test('ouvrir un favori puis le retirer', async ({ page, loginAs, request, adminToken, runId }) => {
    const title = `Favori ${runId}`;
    await favoriteDocument(request, adminToken, title);

    await loginAs('tenant_admin');
    await page.goto('my-documents');
    const list = page.getByRole('list', { name: 'Favoris' });
    const row = list.getByRole('listitem', { name: title });
    await expect(row).toBeVisible();

    await row.getByRole('button', { name: new RegExp(title) }).click();
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    await page.getByRole('button', { name: 'Fermer', exact: true }).last().click();
    await expect(page.getByRole('heading', { name: title })).toHaveCount(0);

    const star = row.getByRole('button', { name: 'Retirer des favoris' });
    await expect(star).toHaveAttribute('aria-pressed', 'true');
    await star.click();
    await expect(row).toHaveCount(0);

    const res = await request.get(`${API_URL}/me/favorites?limit=100`, { headers: { Authorization: `Bearer ${adminToken}` } });
    expect(((await res.json()) as { title: string }[]).map((d) => d.title)).not.toContain(title);
  });

  test('récents vides par défaut, partagés filtrés « À traiter »', async ({ page, loginAs }) => {
    await loginAs('manager');
    await page.goto('my-documents?tab=recent');
    await expect(page.getByRole('tab', { name: 'Récents' })).toHaveAttribute('aria-selected', 'true');
    // Le suivi des ouvertures est désactivé par défaut côté serveur (X-Recent-Tracking-Enabled: false).
    await expect(page.getByText('Historique désactivé', { exact: true })).toBeVisible();
    await expect(page.getByText('Les documents ouverts ne sont pas mémorisés.')).toBeVisible();

    await page.getByRole('tab', { name: 'Partagés avec moi' }).click();
    await expect(page).toHaveURL(/tab=shared/);
    const assigned = page.waitForRequest((r) => r.url().includes('/me/shared') && r.url().includes('reason=assigned'));
    await page.getByRole('button', { name: 'À traiter' }).click();
    await assigned;
    await expect(page.getByRole('button', { name: 'À traiter' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('suivi actif : liste vide ordinaire, sans badge', async ({ page, loginAs }) => {
    await page.route('**/me/recent?*', async (route) => {
      const response = await route.fetch();
      await route.fulfill({
        response,
        headers: { ...response.headers(), 'x-recent-tracking-enabled': 'true' },
      });
    });
    await loginAs('manager');
    await page.goto('my-documents?tab=recent');
    await expect(page.getByText('Aucun document ouvert récemment.')).toBeVisible();
    await expect(page.getByText('Historique désactivé', { exact: true })).toHaveCount(0);
  });

  test('liste indisponible : message et « Réessayer », pas de liste vide', async ({ page, loginAs }) => {
    let fail = true;
    await page.route('**/me/favorites?*', (route) =>
      fail
        ? route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ detail: 'Service indisponible' }) })
        : route.continue(),
    );
    await loginAs('manager');
    await page.goto('my-documents');
    await expect(page.getByText('Liste indisponible pour le moment.')).toBeVisible();
    await expect(page.getByText('Aucun favori')).toHaveCount(0);
    // L'erreur appartient à l'onglet en échec : elle ne suit pas l'utilisateur sur un autre onglet.
    await page.getByRole('tab', { name: 'Récents' }).click();
    await expect(page.getByText('Liste indisponible pour le moment.')).toHaveCount(0);
    await page.getByRole('tab', { name: 'Favoris' }).click();
    await expect(page.getByText('Liste indisponible pour le moment.')).toBeVisible();
    fail = false;
    await page.getByRole('button', { name: 'Réessayer' }).click();
    await expect(page.getByText('Liste indisponible pour le moment.')).toHaveCount(0);
    await expect(page.getByTestId('my-documents-count')).toBeVisible();
  });

  test('un refus du serveur est affiché tel quel et le favori reste', async ({ page, loginAs, request, adminToken, runId }) => {
    const title = `Favori refus ${runId}`;
    await favoriteDocument(request, adminToken, title);
    const detail = 'Document introuvable.';
    await page.route('**/me/favorites/*', (route) =>
      route.request().method() === 'DELETE'
        ? route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ detail }) })
        : route.continue(),
    );

    await loginAs('tenant_admin');
    await page.goto('my-documents');
    const row = page.getByRole('list', { name: 'Favoris' }).getByRole('listitem', { name: title });
    await row.getByRole('button', { name: 'Retirer des favoris' }).click();
    await expect(page.getByText(detail)).toBeVisible();
    await expect(row).toBeVisible();
  });
});
