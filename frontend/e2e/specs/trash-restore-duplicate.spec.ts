import type { Page, Route } from '@playwright/test';
import { test, expect } from '../fixtures/auth.fixture';

/**
 * Restaurer depuis la corbeille réussit toujours. Si un document identique est déjà actif
 * (`identical_document` dans la réponse), un avertissement non bloquant le nomme, avec un lien
 * vers ce document et vers la vue Doublons. Réponses simulées.
 */

const DOC = {
  id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  title: 'Note de service redéposée',
  status: 'draft',
  logical_space_path: null,
  deleted_by: null,
};
const TWIN = { id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', title: 'Note de service' };

const json = (route: Route, body: unknown, headers: Record<string, string> = {}) =>
  route.fulfill({ status: 200, contentType: 'application/json', headers, body: JSON.stringify(body) });

async function mockTrash(page: Page, identical: typeof TWIN | null) {
  let restored = false;
  await page.route('**/authz/me/permissions?*', (route) => {
    const checks = new URL(route.request().url()).searchParams.get('checks') ?? '';
    return json(route, Object.fromEntries(checks.split(',').filter(Boolean).map((c) => [c, true])));
  });
  await page.route(/\/api\/v1\/documents\/trash(\?|$)/, (route) => {
    const items = restored ? [] : [DOC];
    return json(route, items, { 'X-Total-Count': String(items.length) });
  });
  await page.route(/\/api\/v1\/documents\/[^/]+\/restore$/, (route) => {
    restored = true;
    return json(route, { message: 'Document restaure.', identical_document: identical });
  });
}

test.describe('Corbeille : restauration d’un doublon', () => {
  test('TRD-01 — Given un double actif, When restaurer, Then avertissement avec liens, sans blocage', async ({ loginAs, page }) => {
    await mockTrash(page, TWIN);
    await loginAs('tenant_admin');
    await page.goto('trash');

    await page.getByRole('button', { name: `Restaurer ${DOC.title}` }).click();
    const notice = page.getByRole('status').filter({ hasText: 'Un document identique existe déjà' });
    await expect(notice).toBeVisible();
    await expect(notice.getByRole('link', { name: TWIN.title })).toHaveAttribute('href', new RegExp(String.raw`/documents\?open=${TWIN.id}$`));
    await expect(notice.getByRole('link', { name: 'Voir les doublons' })).toHaveAttribute('href', /\/duplicates$/);
    // La restauration est faite : la ligne quitte la corbeille.
    await expect(page.getByText('La corbeille est vide.')).toBeVisible();

    await notice.getByRole('button', { name: 'Fermer l’avertissement' }).click();
    await expect(notice).toHaveCount(0);
  });

  test('TRD-02 — Given aucun double lisible, When restaurer, Then pas d’avertissement', async ({ loginAs, page }) => {
    await mockTrash(page, null);
    await loginAs('tenant_admin');
    await page.goto('trash');

    await page.getByRole('button', { name: `Restaurer ${DOC.title}` }).click();
    await expect(page.getByText('La corbeille est vide.')).toBeVisible();
    await expect(page.getByText('Un document identique existe déjà')).toHaveCount(0);
  });
});
