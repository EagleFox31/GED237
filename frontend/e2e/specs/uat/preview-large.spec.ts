import * as XLSX from 'xlsx';

import { test, expect, API_URL, apiLogin } from '../../fixtures/uat.fixture';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Classeur de deux onglets : « Budget » (en-tête + 599 lignes) et « Résumé » (3 lignes). */
function workbook(): Buffer {
  const book = XLSX.utils.book_new();
  const rows = [['Ligne', 'Montant'], ...Array.from({ length: 599 }, (_, i) => [`L${i + 1}`, i * 10])];
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), 'Budget');
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([['Total'], [5990], ['fin']]), 'Résumé');
  return XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

/**
 * Lot 11 (gros fichiers) : l'aperçu Excel ne convertit que l'onglet affiché et s'arrête aux
 * 500 premières lignes, avec un message ; l'onglet court s'affiche en entier.
 */
test('aperçu Excel : onglet géant tronqué avec message, onglet court complet', async ({
  page,
  loginAs,
  request,
  runId,
}) => {
  const token = await apiLogin(request, 'tenant_admin');
  const title = `Budget aperçu ${runId}`;
  const res = await request.post(`${API_URL}/documents/upload`, {
    headers: { Authorization: `Bearer ${token}` },
    multipart: { title, file: { name: `budget-${runId}.xlsx`, mimeType: XLSX_MIME, buffer: workbook() } },
  });
  expect(res.ok(), 'upload xlsx').toBeTruthy();

  await loginAs('tenant_admin');
  await page.goto(`spaces?q=${encodeURIComponent(runId)}`);
  const doc = page.getByLabel(new RegExp(`^${title} — `));
  await expect(doc).toBeVisible();
  await doc.focus();
  await page.keyboard.press('Enter');

  const notice = page.getByTestId('xlsx-truncated');
  await expect(notice).toHaveText(
    'Aperçu limité aux 500 premières lignes sur 600. Téléchargez le fichier pour tout voir.',
  );
  await expect(page.locator('.xlsx-preview tr')).toHaveCount(500);

  await page.getByRole('button', { name: 'Résumé' }).click();
  await expect(notice).toHaveCount(0);
  await expect(page.locator('.xlsx-preview')).toContainText('5990');
});
