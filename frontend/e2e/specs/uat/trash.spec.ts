import type { APIRequestContext } from '@playwright/test';

import { test, expect, API_URL, apiLogin } from '../../fixtures/uat.fixture';
import { trash, upload } from './trashApi';

/**
 * Corbeille : mise à la corbeille depuis l'explorateur, restauration, suppression définitive.
 * Les actions définitives suivent les droits renvoyés par le serveur (GET /authz/me/permissions),
 * jamais un rôle codé en dur. Seed : seul le super_admin a `documents purge` (décision du PO du 18/11) ;
 * tenant_admin et Manager mettent à la corbeille et restaurent, sans rien effacer.
 */
async function canPurge(request: APIRequestContext, token: string): Promise<boolean> {
  const res = await request.get(`${API_URL}/authz/me/permissions?checks=documents:purge`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.ok(), 'GET /authz/me/permissions').toBeTruthy();
  return ((await res.json()) as Record<string, boolean>)['documents:purge'] === true;
}

// « Vider » (purge de tout le tenant) vit dans trash-empty.spec.ts, projet `uat-destructive`.
test.describe('Corbeille', () => {
  test('explorateur → corbeille → restauration', async ({ page, loginAs, adminApi, runId }) => {
    const title = `Corbeille restaurée ${runId}`;
    await adminApi.uploadDocument(`corbeille-r-${runId}.txt`, title, `Restaurer ${runId}`);

    await loginAs('tenant_admin');
    await page.goto(`spaces?q=${encodeURIComponent(runId)}`);
    const item = page.getByLabel(new RegExp(`^${title} — `));
    await item.click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Mettre à la corbeille', exact: true }).click();
    await expect(item).toHaveCount(0);

    await page.getByRole('button', { name: 'Corbeille', exact: true }).click();
    const list = page.getByRole('list', { name: 'Documents dans la corbeille' });
    await expect(list.getByText(title)).toBeVisible();
    await expect(page.getByTestId('trash-count')).not.toHaveText('0');

    await page.getByRole('button', { name: `Restaurer ${title}` }).click();
    await expect(list.getByText(title)).toHaveCount(0);

    await page.goto(`spaces?q=${encodeURIComponent(runId)}`);
    await expect(page.getByLabel(new RegExp(`^${title} — `))).toBeVisible();
  });

  test('administrateur de l’institution : suppression définitive masquée et refusée par le serveur', async ({
    page,
    loginAs,
    request,
    adminToken,
    runId,
  }) => {
    expect(await canPurge(request, adminToken), 'tenant_admin sans documents:purge (seed)').toBe(false);
    const title = `Corbeille non purgée ${runId}`;
    const doc = await upload(request, adminToken, runId, title);
    await trash(request, adminToken, doc.id);
    const headers = { Authorization: `Bearer ${adminToken}` };
    expect((await request.delete(`${API_URL}/documents/${doc.id}/purge`, { headers })).status()).toBe(403);

    await loginAs('tenant_admin');
    await page.getByRole('button', { name: 'Corbeille', exact: true }).click();
    const list = page.getByRole('list', { name: 'Documents dans la corbeille' });
    await expect(list.getByText(title)).toBeVisible();
    await expect(page.getByRole('button', { name: `Supprimer définitivement ${title}` })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Vider la corbeille' })).toHaveCount(0);

    await page.getByRole('button', { name: `Restaurer ${title}` }).click();
    await expect(list.getByText(title)).toHaveCount(0);
  });

  test('Manager : restaurer oui, actions définitives masquées (droit refusé par le serveur)', async ({
    page,
    loginAs,
    request,
    runId,
  }) => {
    const token = await apiLogin(request, 'manager');
    expect(await canPurge(request, token), 'manager sans documents:purge (seed)').toBe(false);
    const title = `Corbeille manager ${runId}`;
    const doc = await upload(request, token, runId, title);
    await trash(request, token, doc.id);

    await loginAs('manager');
    await page.getByRole('button', { name: 'Corbeille', exact: true }).click();
    await expect(page.getByRole('button', { name: `Restaurer ${title}` })).toBeVisible();
    await expect(page.getByRole('button', { name: `Supprimer définitivement ${title}` })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Vider la corbeille' })).toHaveCount(0);

    await page.getByRole('button', { name: `Restaurer ${title}` }).click();
    await expect(page.getByRole('button', { name: `Restaurer ${title}` })).toHaveCount(0);
  });

  /**
   * Aucun compte de la pile e2e n'a `documents:purge` sur ce tenant ni ne peut archiver (super_admin
   * seul, sur PLATFORM). L'écran reçoit donc le droit de purge et le statut archivé par
   * interception : on vérifie ici le seul affichage (cadenas, pas de « Vider »), sans appel de
   * purge. La règle serveur est couverte par backend/tests/api/test_trash_purge.py.
   */
  test('droit de purge : document archivé dans la corbeille, cadenas et pas de « Vider »', async ({
    page,
    loginAs,
    request,
    adminToken,
    runId,
  }) => {
    const kept = `Corbeille archivée ${runId}`;
    const keptDoc = await upload(request, adminToken, runId, kept);
    await trash(request, adminToken, keptDoc.id);
    await page.route('**/documents/trash?*', async (route) => {
      const response = await route.fetch();
      const items = ((await response.json()) as { id: string; status: string }[])
        .filter((doc) => doc.id === keptDoc.id)
        .map((doc) => ({ ...doc, status: 'archived' }));
      await route.fulfill({ response, json: items, headers: { ...response.headers(), 'x-total-count': String(items.length) } });
    });
    await page.route('**/authz/me/permissions?*', async (route) => {
      const response = await route.fetch();
      const rights = (await response.json()) as Record<string, boolean>;
      await route.fulfill({ response, json: { ...rights, 'documents:purge': true } });
    });

    await loginAs('tenant_admin');
    await page.getByRole('button', { name: 'Corbeille', exact: true }).click();
    const list = page.getByRole('list', { name: 'Documents dans la corbeille' });
    await expect(list.getByText(kept)).toBeVisible();
    await expect(page.getByRole('img', { name: `${kept} : signé ou archivé, ne peut pas être effacé` })).toBeVisible();
    await expect(page.getByRole('button', { name: `Supprimer définitivement ${kept}` })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Vider la corbeille' })).toHaveCount(0);

    await page.getByRole('button', { name: `Restaurer ${kept}` }).click();
    await expect(list.getByText(kept)).toHaveCount(0);
  });
});
