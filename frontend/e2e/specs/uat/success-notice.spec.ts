import type { Route } from '@playwright/test';
import { test, expect } from '../../fixtures/auth.fixture';

/**
 * Audit « parcours réel du fonctionnaire », friction 1 : aucune réassurance après une action clé.
 * Après « Soumettre au visa », une confirmation verte dit que c'est fait. Réponses simulées.
 */

const VALIDATOR = { id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', full_name: 'Chef de Service', email: 'chef@example.cm', role: 'manager' };
const DRAFT = {
  id: 'd-1',
  title: 'Note de service Garoua',
  status: 'draft',
  tags: [],
  created_at: '2026-11-19T08:00:00Z',
  updated_at: '2026-11-19T09:00:00Z',
};

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

test.describe('Confirmation après une action clé', () => {
  test('OK-01 — Given un brouillon, When Soumettre au visa, Then confirmation verte', async ({ loginAs, page }) => {
    let submitted = false;
    await page.route(/\/api\/v1\/documents\/?(\?|$)/, (route) => json(route, submitted ? [] : [DRAFT]));
    await page.route(/\/api\/v1\/workflows\/validators/, (route) => json(route, [VALIDATOR]));
    await page.route(/\/api\/v1\/workflows\/document\/d-1\/steps/, (route) => {
      submitted = true;
      return json(route, []);
    });

    await loginAs('collaborator');
    await expect(page.getByText('Mon Atelier')).toBeVisible({ timeout: 10_000 });

    const card = page.getByTestId('draft-card').filter({ hasText: DRAFT.title });
    await card.getByRole('button', { name: 'Soumettre' }).click();
    await page.locator('select').selectOption(VALIDATOR.id);
    await page.getByRole('button', { name: 'Soumettre au visa' }).click();

    const notice = page.getByTestId('success-notice');
    await expect(notice).toHaveText(/Document envoyé pour validation\./);
    await expect(notice).toHaveAttribute('role', 'status');
    // Fermeture manuelle possible (WCAG 2.2.1).
    await notice.getByRole('button', { name: 'Fermer' }).click();
    await expect(notice).toHaveCount(0);
  });
});
