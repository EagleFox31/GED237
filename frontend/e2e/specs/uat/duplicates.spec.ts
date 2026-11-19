import type { APIRequestContext } from '@playwright/test';

import { test, expect, API_URL, apiLogin } from '../../fixtures/uat.fixture';

/**
 * Doublons (#171) : garder une copie, les autres vont à la corbeille.
 * L'upload refuse un fichier identique ; un vrai doublon naît d'une restauration :
 * on importe A, on le met à la corbeille, on réimporte le même contenu (B), puis on restaure A.
 */
async function makeDuplicatePair(request: APIRequestContext, token: string, runId: string, tag: string) {
  const headers = { Authorization: `Bearer ${token}` };
  const content = Buffer.from(`Doublon ${tag} ${runId}`, 'utf-8');
  const upload = async (title: string) => {
    const res = await request.post(`${API_URL}/documents/upload`, {
      headers,
      multipart: { title, file: { name: `doublon-${tag}-${runId}.txt`, mimeType: 'text/plain', buffer: content } },
    });
    expect(res.ok(), `upload ${title}`).toBeTruthy();
    return ((await res.json()) as { id: string }).id;
  };

  const original = `Original ${tag} ${runId}`;
  const copy = `Copie ${tag} ${runId}`;
  const originalId = await upload(original);
  expect((await request.delete(`${API_URL}/documents/${originalId}`, { headers })).ok(), 'trash original').toBeTruthy();
  await upload(copy);
  expect((await request.post(`${API_URL}/documents/${originalId}/restore`, { headers })).ok(), 'restore original').toBeTruthy();
  return { original, copy };
}

test.describe('Doublons', () => {
  test("administrateur : garder l'original, la copie va à la corbeille", async ({ page, loginAs, request, adminToken, runId }) => {
    const { original, copy } = await makeDuplicatePair(request, adminToken, runId, 'admin');

    await loginAs('tenant_admin');
    await page.goto('duplicates');
    const group = page.getByRole('listitem', { name: `Doublons de ${original}` });
    await expect(group).toBeVisible();
    await expect(group.getByRole('radio', { name: new RegExp(`^${original}`) })).toBeChecked();
    await expect(group.getByText('Original', { exact: true })).toBeVisible();

    await group.getByRole('button', { name: 'Mettre les autres à la corbeille' }).click();
    await expect(page.getByText('1 copie mise à la corbeille.')).toBeVisible();
    await expect(group).toHaveCount(0);

    await page.getByRole('link', { name: 'Voir la corbeille' }).click();
    const trash = page.getByRole('list', { name: 'Documents dans la corbeille' });
    await expect(trash.getByText(copy)).toBeVisible();
    await expect(trash.getByText(original)).toHaveCount(0);
  });

  test('Manager : garder la copie récente, l’original va à la corbeille', async ({ page, loginAs, request, runId }) => {
    const token = await apiLogin(request, 'manager');
    const { original, copy } = await makeDuplicatePair(request, token, runId, 'manager');

    await loginAs('manager');
    await page.goto('duplicates');
    const group = page.getByRole('listitem', { name: `Doublons de ${original}` });
    await group.getByRole('radio', { name: new RegExp(`^${copy}`) }).check();
    await group.getByRole('button', { name: 'Mettre les autres à la corbeille' }).click();
    await expect(group).toHaveCount(0);

    await page.goto('trash');
    await expect(page.getByRole('list', { name: 'Documents dans la corbeille' }).getByText(original)).toBeVisible();
  });

  test('refus du serveur : message affiché, le groupe reste', async ({ page, loginAs, request, adminToken, runId }) => {
    const { original } = await makeDuplicatePair(request, adminToken, runId, 'refus');
    const detail = `Refus simulé ${runId}`;
    await page.route('**/duplicates/resolve', (route) =>
      route.fulfill({ status: 409, json: { status: 409, detail, error_code: 'NOT_DUPLICATE' } }),
    );

    await loginAs('tenant_admin');
    await page.goto('duplicates');
    const group = page.getByRole('listitem', { name: `Doublons de ${original}` });
    await group.getByRole('button', { name: 'Mettre les autres à la corbeille' }).click();
    await expect(page.getByText(detail)).toBeVisible();
    await expect(group).toBeVisible();
    await expect(page.getByText('mise à la corbeille.')).toHaveCount(0);
  });
});
