import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures/auth.fixture';

/**
 * T9 — périmètre réglable par rôle (contrat : section 9 de l'instruction élément 13).
 *
 * Interrupteur unique : E2E_SCOPES_REAL=1 utilise l'API réelle (après le T0 backend) ;
 * sinon GET/PUT /admin/access-scopes sont simulés ci-dessous. Les cas qui n'ont de sens qu'avec
 * un serveur simulé (422, 403, 404) sont ignorés en mode réel.
 */
const REAL_API = process.env.E2E_SCOPES_REAL === '1';

type Row = {
  role: string;
  resource: string;
  scope: string;
  default: string;
  ceiling: string;
  overridden: boolean;
};

const initialRows = (): Row[] => [
  { role: 'manager', resource: 'documents', scope: 'unit', default: 'unit', ceiling: 'unit_tree', overridden: false },
  { role: 'collaborator', resource: 'documents', scope: 'own', default: 'own', ceiling: 'unit', overridden: false },
];

type Mode = 'ok' | 'put422' | 'get403' | 'get404';

async function mockAccessScopes(page: Page, mode: Mode): Promise<{ puts: unknown[] }> {
  const state = { rows: initialRows(), puts: [] as unknown[] };
  if (REAL_API) return state;
  await page.route('**/admin/access-scopes', async (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      if (mode === 'get403') return route.fulfill({ status: 403, json: { detail: 'Forbidden' } });
      if (mode === 'get404') return route.fulfill({ status: 404, json: { detail: 'Not Found' } });
      return route.fulfill({ status: 200, json: state.rows });
    }
    if (method === 'PUT') {
      const body = route.request().postDataJSON() as { role: string; resource: string; scope: string };
      state.puts.push(body);
      if (mode === 'put422') return route.fulfill({ status: 422, json: { detail: 'scope above ceiling' } });
      const row = state.rows.find((r) => r.role === body.role && r.resource === body.resource);
      if (!row) return route.fulfill({ status: 404, json: { detail: 'Not Found' } });
      row.scope = body.scope;
      row.overridden = body.scope !== row.default;
      return route.fulfill({ status: 200, json: row });
    }
    return route.fallback();
  });
  return state;
}

test.describe('Feature: périmètre réglable (T9)', () => {
  test('Given super_admin, When change manager/documents then reset, Then the select follows', async ({ loginAs, page }) => {
    const mock = await mockAccessScopes(page, 'ok');
    await loginAs('super_admin');
    await page.goto('authz');

    const panel = page.getByTestId('access-scopes');
    await expect(panel).toBeVisible({ timeout: 10_000 });
    const select = page.getByTestId('scope-manager-documents');
    await expect(select.locator('option:checked')).toHaveText('Son unité (par défaut)');
    // Au-dessus du plafond : grisé.
    await expect(select.locator('option', { hasText: "Toute l'institution" })).toBeDisabled();

    await select.selectOption('unit_tree');
    await expect(select.locator('option:checked')).toHaveText('Son unité et ses sous-unités');
    await expect(page.getByRole('alert')).toHaveCount(0);

    await select.selectOption('unit');
    await expect(select.locator('option:checked')).toHaveText('Son unité (par défaut)');
    if (!REAL_API) {
      expect(mock.puts).toEqual([
        { role: 'manager', resource: 'documents', scope: 'unit_tree' },
        { role: 'manager', resource: 'documents', scope: 'unit' },
      ]);
    }
  });

  test('Given a 422, When change the scope, Then the error shows on the row and the value is kept', async ({ loginAs, page }) => {
    test.skip(REAL_API, 'cas simulé uniquement');
    await mockAccessScopes(page, 'put422');
    await loginAs('super_admin');
    await page.goto('authz');

    const select = page.getByTestId('scope-manager-documents');
    await expect(select).toBeVisible({ timeout: 10_000 });
    await select.selectOption('unit_tree');
    await expect(page.getByRole('alert').filter({ hasText: 'Ce périmètre est trop large pour ce rôle.' })).toBeVisible();
    await expect(select.locator('option:checked')).toHaveText('Son unité (par défaut)');
  });

  for (const mode of ['get403', 'get404'] as const) {
    test(`Given ${mode}, When open /authz, Then the panel is hidden and the grid stays`, async ({ loginAs, page }) => {
      test.skip(REAL_API, 'cas simulé uniquement');
      await mockAccessScopes(page, mode);
      await loginAs('super_admin');
      await page.goto('authz');

      await expect(page.getByTestId('rights-grid')).toBeVisible({ timeout: 10_000 });
      await expect(page.getByTestId('access-scopes')).toHaveCount(0);
    });
  }
});
