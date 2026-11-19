import type { Route } from '@playwright/test';
import { test, expect } from '../../fixtures/auth.fixture';

/**
 * Audit « parcours réel du fonctionnaire », friction : le rédacteur qui retrouve son brouillon dans
 * « Mes Documents » doit repasser par « Mon Atelier » pour le soumettre. Réponses simulées.
 */

const CHEF = { id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', full_name: 'Chef de Service', email: 'chef@example.cm', role: 'manager' };
const DIRECTEUR = { id: 'ffffffff-ffff-4fff-8fff-ffffffffffff', full_name: 'Directeur Régional', email: 'dir@example.cm', role: 'manager' };

const doc = (id: string, title: string, ownerId: string) => ({
  id,
  title,
  status: 'draft',
  owner_id: ownerId,
  tags: [],
  mime_type: 'application/pdf',
  file_size: 2048,
  current_version_number: 1,
  created_at: '2026-11-19T08:00:00Z',
  updated_at: '2026-11-19T09:00:00Z',
});

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

test.describe('Soumettre depuis « Mes Documents »', () => {
  test('SUB-01 — Given mon brouillon, When Soumettre, Then dernier valideur proposé et confirmation verte', async ({ loginAs, page }) => {
    let me = '';
    let submittedTo = '';
    await page.route(/\/api\/v1\/documents\/?(\?|$)/, (route) =>
      json(route, submittedTo ? [] : [doc('d-1', 'Note de service Garoua', me), doc('d-2', 'Brouillon d un collègue', 'autre-agent')]),
    );
    await page.route(/\/api\/v1\/workflows\/validators/, (route) => json(route, [CHEF, DIRECTEUR]));
    await page.route(/\/api\/v1\/workflows\/document\/d-1\/steps/, (route) => {
      submittedTo = (route.request().postDataJSON() as { assigned_to: string }[])[0]?.assigned_to ?? '';
      return json(route, []);
    });

    await loginAs('collaborator');
    me = await page.evaluate(() => JSON.parse(sessionStorage.getItem('user_profile') ?? '{}').userId as string);
    // Le directeur a été choisi lors d'une soumission précédente, dans ce navigateur.
    await page.evaluate(({ key, id }) => localStorage.setItem(key, id), { key: `ged237.lastValidator.${me}`, id: DIRECTEUR.id });
    await page.goto('documents');

    await expect(page.getByRole('button', { name: 'Soumettre Brouillon d un collègue' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Soumettre Note de service Garoua' }).click();

    const dialog = page.getByRole('dialog', { name: 'Circuit de Validation' });
    await expect(dialog.getByLabel(/Valideur/)).toHaveValue(DIRECTEUR.id);
    await dialog.getByRole('button', { name: 'Soumettre au visa' }).click();

    await expect(page.getByTestId('success-notice')).toHaveText(/Document envoyé pour validation\./);
    await expect(dialog).toHaveCount(0);
    expect(submittedTo).toBe(DIRECTEUR.id);
  });
});
