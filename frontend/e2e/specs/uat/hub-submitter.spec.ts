import type { Route } from '@playwright/test';
import { test, expect } from '../../fixtures/auth.fixture';

/**
 * Audit « parcours réel du fonctionnaire », friction : sur l'Espace Manager, le valideur ne voit pas
 * qui lui a envoyé le document. Même ligne que /tasks (L12-3). Réponses simulées.
 */

const TASK = {
  id: 's-1',
  document_id: 'd-1',
  step_order: 1,
  label: 'Validation Manager',
  status: 'in_progress',
  expected_action_type: 'visa',
  created_at: '2026-11-19T08:30:00Z',
  submitted_by: 'u-awa',
  submitted_by_name: 'Awa Ndi',
  document: { id: 'd-1', title: 'Note de service Garoua', status: 'pending_validation' },
};

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

test.describe('Expéditeur sur l Espace Manager', () => {
  test('HUB-01 — Given une tâche envoyée par Awa, When Espace Manager, Then « Envoyé par Awa Ndi » avec la date', async ({ loginAs, page }) => {
    await page.route(/\/api\/v1\/workflows\/pending\/?(\?|$)/, (route) => json(route, [TASK]));

    await loginAs('manager');
    const card = page.locator('div.glass').filter({ hasText: TASK.document.title });
    // 08:30 UTC = 09:30 à Douala.
    await expect(card.getByTestId('task-submission')).toHaveText('Envoyé par Awa Ndi le 19/11/2026 à 09:30', { timeout: 10_000 });
  });
});
