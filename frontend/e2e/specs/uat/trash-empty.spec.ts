import { test, expect, API_URL } from '../../fixtures/uat.fixture';
import { SEED } from '../../data/seed';
import { setAsideTrash, trash, upload } from './trashApi';

/**
 * « Vider » purge toute la corbeille du tenant : ce spec tourne seul, après seed et uat
 * (projet `uat-destructive` de playwright.config.ts), pour ne croiser aucun autre test.
 * Jamais sur une pile demo : demo-counters attend la corbeille de démo intacte, et seed_e2e ne
 * sait remettre que les documents du manifeste e2e. D'où le garde ci-dessous, lu sur la pile
 * elle-même (seed_demo vide les documents du tenant : le marqueur e2e y est absent).
 */
test('administrateur : « Vider » efface la corbeille et relit la liste', async ({ page, loginAs, request, adminToken, runId }) => {
  const headers = { Authorization: `Bearer ${adminToken}` };
  const before = await request.get(`${API_URL}/documents/trash?skip=0&limit=100`, { headers });
  expect(before.ok(), 'GET /documents/trash').toBeTruthy();
  const titles = new Set(((await before.json()) as { title: string }[]).map((doc) => doc.title));
  test.skip(
    !SEED.expected.trash.every((title) => titles.has(title)),
    'Pas une pile e2e (corbeille du seed e2e absente) : « Vider » ne tourne pas ici.',
  );

  const loose = `Corbeille à vider ${runId}`;
  const looseDoc = await upload(request, adminToken, runId, loose);
  await trash(request, adminToken, looseDoc.id);
  const putBack = await setAsideTrash(request, adminToken, looseDoc.id);
  try {
    await loginAs('tenant_admin');
    await page.getByRole('button', { name: 'Corbeille', exact: true }).click();
    const list = page.getByRole('list', { name: 'Documents dans la corbeille' });
    await expect(list.getByText(loose)).toBeVisible();

    await page.getByRole('button', { name: 'Vider la corbeille' }).click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toContainText('sauf ceux signés ou archivés');
    await dialog.getByRole('button', { name: 'Vider' }).click();

    // Liste relue après la purge : plus rien à effacer, donc plus de « Vider ».
    await expect(list.getByText(loose)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Vider la corbeille' })).toHaveCount(0);
    expect((await request.get(`${API_URL}/documents/${looseDoc.id}`, { headers })).status()).toBe(404);
  } finally {
    await putBack();
  }
});
