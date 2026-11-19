import { test, expect } from '../fixtures/auth.fixture';
import { DocumentsPage } from '../pages/documents.page';

// Liste de l'explorateur seulement (pas /documents/<id>, /documents/upload, etc.).
const LIST = /\/api\/v1\/documents\/?(\?.*)?$/;
const TOTAL = 230;

// L'API est sur une autre origine : sans « expose », le navigateur masque X-Total-Count.
const listHeaders = (request: { headers(): Record<string, string> }, total: number) => ({
  'Access-Control-Allow-Origin': request.headers()['origin'] ?? '*',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Expose-Headers': 'X-Total-Count',
  'X-Total-Count': String(total),
});

const fakeDoc = (index: number) => ({
  id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
  title: `Courrier ${index + 1}`,
  status: 'draft',
  file_type: 'application/pdf',
  mime_type: 'application/pdf',
  file_size: 2048,
  current_version_number: 1,
  document_category_id: null,
  category_name: null,
  created_at: '2026-11-19T08:00:00Z',
  updated_at: '2026-11-19T08:00:00Z',
});

test.describe('Mes Documents : compteur et suite de la liste (audit n° 14)', () => {
  test('affiche « N sur M », charge la suite, puis signale la fin de la liste', async ({ page, loginAs }) => {
    const requested: URL[] = [];
    await page.route(LIST, (route) => {
      const url = new URL(route.request().url());
      requested.push(url);
      const skip = Number(url.searchParams.get('skip') ?? 0);
      const limit = Number(url.searchParams.get('limit') ?? 100);
      const items = Array.from({ length: Math.max(0, Math.min(limit, TOTAL - skip)) }, (_, i) => fakeDoc(skip + i));
      return route.fulfill({ json: items, headers: listHeaders(route.request(), TOTAL) });
    });
    await loginAs('tenant_admin');
    const docsPage = new DocumentsPage(page);
    await docsPage.goto();
    await docsPage.expectDocumentsLoaded();

    const counter = page.getByTestId('documents-count');
    const more = page.getByRole('button', { name: 'Afficher plus' });
    await expect(counter).toContainText('100 sur 230 documents');

    await more.click();
    await expect(counter).toContainText('200 sur 230 documents');
    await more.click();
    await expect(counter).toContainText('230 documents • fin de la liste');
    await expect(more).toBeHidden();
    await expect(page.getByText('Courrier 230', { exact: true })).toBeVisible();

    const skips = requested.map((url) => url.searchParams.get('skip'));
    expect(skips.slice(-2)).toEqual(['100', '200']);
  });

  test('le filtre catégorie part au serveur et le total suit', async ({ page, loginAs }) => {
    const categoryId = '11111111-1111-4111-8111-111111111111';
    await page.route('**/api/v1/categories*', (route) =>
      route.fulfill({ json: [{ id: categoryId, name: 'Courrier', code: 'COUR' }] }),
    );
    await page.route(LIST, (route) => {
      const filtered = new URL(route.request().url()).searchParams.get('category_id') === categoryId;
      const count = filtered ? 3 : 150;
      const items = Array.from({ length: Math.min(count, 100) }, (_, i) => fakeDoc(i));
      return route.fulfill({ json: items, headers: listHeaders(route.request(), count) });
    });
    await loginAs('tenant_admin');
    const docsPage = new DocumentsPage(page);
    await docsPage.goto();
    await docsPage.expectDocumentsLoaded();

    const counter = page.getByTestId('documents-count');
    await expect(counter).toContainText('100 sur 150 documents');
    await docsPage.categoryFilter.selectOption(categoryId);
    await expect(counter).toContainText('3 documents • fin de la liste');
  });
});
