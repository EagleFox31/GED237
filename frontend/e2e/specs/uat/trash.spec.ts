import type { APIRequestContext } from '@playwright/test';

import { test, expect, API_URL, apiLogin } from '../../fixtures/uat.fixture';
import { trash, upload } from './trashApi';

/**
 * Corbeille : mise à la corbeille depuis l'explorateur, restauration, suppression définitive.
 * Les actions définitives suivent les droits renvoyés par le serveur (GET /authz/me/permissions),
 * jamais un rôle codé en dur. Seed : tenant_admin a `documents purge`, le Manager seulement `trash_own`.
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

  test('administrateur : suppression définitive après confirmation', async ({ page, loginAs, request, adminToken, runId }) => {
    expect(await canPurge(request, adminToken), 'tenant_admin a documents:purge (seed)').toBe(true);
    const title = `Corbeille purgée ${runId}`;
    const doc = await upload(request, adminToken, runId, title);
    await trash(request, adminToken, doc.id);

    await loginAs('tenant_admin');
    await page.getByRole('button', { name: 'Corbeille', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Vider la corbeille' })).toBeVisible();
    await page.getByRole('button', { name: `Supprimer définitivement ${title}` }).click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toContainText(title);
    await dialog.getByRole('button', { name: 'Supprimer' }).click();
    await expect(page.getByRole('list', { name: 'Documents dans la corbeille' }).getByText(title)).toHaveCount(0);

    const gone = await request.get(`${API_URL}/documents/${doc.id}`, { headers: { Authorization: `Bearer ${adminToken}` } });
    expect(gone.status()).toBe(404);
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
   * Aucun compte de la pile e2e ne peut archiver : PATCH status=archived exige `documents:manage`
   * (super_admin seul, sur un autre tenant). Le statut est donc posé sur la vraie réponse de la
   * liste ; la conservation côté serveur est couverte par backend/tests/api/test_trash_purge.py.
   */
  test('administrateur : document archivé dans la corbeille, cadenas et pas de « Vider »', async ({
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
