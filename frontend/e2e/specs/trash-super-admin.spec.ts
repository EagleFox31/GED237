import type { Route } from '@playwright/test';
import { test, expect } from '../fixtures/auth.fixture';

/**
 * Corbeille du super-administrateur : sa propre corbeille (PLATFORM) est vide, il choisit
 * l'institution dont il efface ou vide la corbeille (`?tenant_id=`, honoré par
 * `resolve_trash_tenant`). Réponses simulées : on vérifie ce que l'écran envoie.
 */

const TENANTS = [
  { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: 'Ministère des Finances', short_name: 'MINFI' },
  { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', name: 'Ministère de la Santé', short_name: 'MINSANTE' },
];
const [MINFI] = TENANTS;

const trashed = (id: string, title: string, status = 'draft') => ({
  id,
  title,
  status,
  logical_space_path: null,
  deleted_by: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
});
const DRAFT = trashed('d-1', 'Note de service à effacer');
const SIGNED = trashed('d-2', 'Arrêté signé', 'signed');

const json = (route: Route, body: unknown, status = 200, headers: Record<string, string> = {}) =>
  route.fulfill({ status, contentType: 'application/json', headers, body: JSON.stringify(body) });

test.describe('Corbeille du super-administrateur : choix de l’institution', () => {
  test('TRS-01 — Given super-admin, When il choisit une institution, Then liste, suppression et « Vider » visent cette institution', async ({ loginAs, page }) => {
    const calls: string[] = [];
    let remaining = [DRAFT, SIGNED];

    await page.route('**/authz/me/permissions?*', (route) => {
      const checks = new URL(route.request().url()).searchParams.get('checks') ?? '';
      return json(route, Object.fromEntries(checks.split(',').filter(Boolean).map((c) => [c, true])));
    });
    await page.route(/\/api\/v1\/tenants\/?(\?|$)/, (route) => json(route, TENANTS));
    await page.route(/\/api\/v1\/documents\/trash(\?|\/|$)/, (route) => {
      const request = route.request();
      calls.push(`${request.method()} ${request.url()}`);
      if (request.method() === 'POST') {
        remaining = remaining.filter((d) => d.status === 'signed');
        return json(route, { purged: 1, remaining: 0 });
      }
      const tenantId = new URL(request.url()).searchParams.get('tenant_id');
      const items = tenantId === MINFI.id ? remaining : [];
      return json(route, items, 200, { 'X-Total-Count': String(items.length) });
    });
    await page.route(/\/api\/v1\/documents\/[^/]+\/purge(\?|$)/, (route) => {
      calls.push(`${route.request().method()} ${route.request().url()}`);
      remaining = remaining.filter((d) => d.id !== DRAFT.id);
      return json(route, { message: 'Document definitivement supprime.' });
    });

    await loginAs('super_admin');
    await page.goto('trash');

    const list = page.getByRole('list', { name: 'Documents dans la corbeille' });
    await expect(page.getByText('Choisissez une institution pour voir sa corbeille.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Vider la corbeille' })).toHaveCount(0);
    // Tant qu'aucune institution n'est choisie, aucune corbeille d'institution n'est lue.
    expect(calls.filter((c) => c.includes('tenant_id='))).toEqual([]);

    await page.getByRole('combobox', { name: 'Institution' }).selectOption(MINFI.id);
    await expect(list.getByText(DRAFT.title)).toBeVisible();
    expect(calls.some((c) => c.startsWith('GET') && c.includes(`tenant_id=${MINFI.id}`))).toBe(true);
    // Restaurer n'accepte pas d'institution : l'écran ne le propose pas ici.
    await expect(page.getByRole('button', { name: `Restaurer ${DRAFT.title}` })).toHaveCount(0);
    await expect(page.getByRole('img', { name: `${SIGNED.title} : signé ou archivé, ne peut pas être effacé` })).toBeVisible();

    await page.getByRole('button', { name: `Supprimer définitivement ${DRAFT.title}` }).click();
    await page.getByRole('button', { name: 'Supprimer', exact: true }).click();
    await expect(list.getByText(DRAFT.title)).toHaveCount(0);
    expect(calls).toContainEqual(expect.stringMatching(new RegExp(`^DELETE .*/documents/${DRAFT.id}/purge\\?tenant_id=${MINFI.id}$`)));

    remaining = [DRAFT, SIGNED];
    await page.getByRole('combobox', { name: 'Institution' }).selectOption(TENANTS[1].id);
    await expect(page.getByText('La corbeille est vide.')).toBeVisible();
    await page.getByRole('combobox', { name: 'Institution' }).selectOption(MINFI.id);
    await expect(list.getByText(DRAFT.title)).toBeVisible();

    await page.getByRole('button', { name: 'Vider la corbeille' }).click();
    await expect(page.getByText(`Les documents de ${MINFI.name} seront effacés`)).toBeVisible();
    await page.getByRole('button', { name: 'Vider', exact: true }).click();
    await expect(list.getByText(DRAFT.title)).toHaveCount(0);
    expect(calls).toContainEqual(expect.stringMatching(new RegExp(`^POST .*/documents/trash/empty\\?tenant_id=${MINFI.id}$`)));
  });

  test('TRS-02 — Given administrateur de l’institution, When corbeille, Then pas de choix d’institution', async ({ loginAs, page }) => {
    await page.route(/\/api\/v1\/documents\/trash(\?|$)/, (route) =>
      json(route, [], 200, { 'X-Total-Count': '0' }),
    );
    await loginAs('tenant_admin');
    await page.goto('trash');
    await expect(page.getByText('La corbeille est vide.')).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Institution' })).toHaveCount(0);
  });
});
