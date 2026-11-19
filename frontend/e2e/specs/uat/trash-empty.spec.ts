import { test, expect, API_URL } from '../../fixtures/uat.fixture';
import { SEED } from '../../data/seed';
import { trash, upload } from './trashApi';

/**
 * « Vider » efface toute la corbeille du tenant : réservé au super_admin (décision du PO du 18/11,
 * `documents purge`). L'administrateur de l'institution ne voit pas le bouton et le serveur lui
 * refuse POST /documents/trash/empty : la corbeille reste intacte. Le vidage réel est couvert par
 * backend/tests/api/test_trash_purge.py. Le spec reste dans le projet `uat-destructive` de
 * playwright.config.ts : si le droit revenait par erreur, il ne croiserait aucun autre test.
 */
test('administrateur de l’institution : « Vider » masqué et refusé, corbeille intacte', async ({
  page,
  loginAs,
  request,
  adminToken,
  runId,
}) => {
  const headers = { Authorization: `Bearer ${adminToken}` };
  // Garde : hors pile e2e (ex. pile de démo), on ne touche pas à la corbeille, même pour vérifier un refus.
  const before = await request.get(`${API_URL}/documents/trash?skip=0&limit=100`, { headers });
  expect(before.ok(), 'GET /documents/trash').toBeTruthy();
  const titles = new Set(((await before.json()) as { title: string }[]).map((doc) => doc.title));
  test.skip(
    !SEED.expected.trash.every((title) => titles.has(title)),
    'Pas une pile e2e (corbeille du seed e2e absente) : ce spec ne tourne pas ici.',
  );

  const kept =`Corbeille non vidée ${runId}`;
  const keptDoc = await upload(request, adminToken, runId, kept);
  await trash(request, adminToken, keptDoc.id);

  expect((await request.post(`${API_URL}/documents/trash/empty`, { headers })).status()).toBe(403);

  await loginAs('tenant_admin');
  await page.getByRole('button', { name: 'Corbeille', exact: true }).click();
  const list = page.getByRole('list', { name: 'Documents dans la corbeille' });
  await expect(list.getByText(kept)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Vider la corbeille' })).toHaveCount(0);

  await page.getByRole('button', { name: `Restaurer ${kept}` }).click();
  await expect(list.getByText(kept)).toHaveCount(0);
});
