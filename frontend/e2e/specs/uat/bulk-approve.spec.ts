import type { Route } from '@playwright/test';
import { test, expect } from '../../fixtures/uat.fixture';

/**
 * Tâches & Suivi : viser plusieurs tâches d'un coup. Une seule confirmation (nombre et titres),
 * un appel par tâche sur la route existante, l'échec de l'une n'annule pas les autres.
 * Réponses simulées : on vérifie ce que l'écran envoie et affiche.
 */

const task = (id: string, title: string) => ({
  id,
  document_id: `doc-${id}`,
  step_order: 1,
  label: 'Visa du chef de service',
  assigned_to: null,
  status: 'current',
  expected_action_type: 'visa',
  completed_at: null,
  comment: null,
  created_at: '2026-11-19T08:00:00Z',
  document: { id: `doc-${id}`, title, status: 'in_review', current_version_id: `ver-${id}`, created_at: '2026-11-19T08:00:00Z' },
});

const TASKS = [task('t1', 'Bordereau mission Garoua'), task('t2', 'Note de frais Kribi'), task('t3', 'Ordre de mission Bertoua')];
const REFUSED = 'Étape déjà traitée par un autre agent.';

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

test('BULK-01 — Given 3 tâches, When j en vise 3 et l une échoue, Then une confirmation, 3 appels un par un et l échec listé', async ({ page, loginAs }) => {
  const posted: string[] = [];
  let pending = TASKS;
  await page.route(/\/api\/v1\/workflows\/pending/, (route) => json(route, pending));
  await page.route(/\/api\/v1\/workflows\/step\/(t\d)\/actions$/, (route) => {
    const id = /step\/(t\d)\//.exec(route.request().url())?.[1] ?? '';
    posted.push(`${id} ${JSON.parse(route.request().postData() ?? '{}').outcome}`);
    if (id === 't2') return json(route, { status: 409, detail: REFUSED }, 409);
    return json(route, { id });
  });

  await loginAs('manager');
  await page.goto('tasks');
  const bulk = page.getByTestId('bulk-approve');
  await expect(bulk).toHaveText('Viser la sélection (0)', { timeout: 10_000 });
  await expect(bulk).toBeDisabled();

  await page.getByLabel('Tout sélectionner').check();
  await expect(bulk).toHaveText('Viser la sélection (3)');
  await bulk.click();

  // Une seule confirmation, avec le nombre et la liste.
  const dialog = page.getByRole('dialog', { name: 'Viser 3 tâches ?' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId('bulk-confirm-list').locator('li')).toHaveCount(3);
  pending = [TASKS[1]];
  await dialog.getByRole('button', { name: 'Viser' }).click();

  await expect(page.getByTestId('bulk-outcome').getByRole('status')).toHaveText('2 tâches visées.');
  const failed = page.getByTestId('bulk-outcome').getByRole('alert');
  await expect(failed).toContainText('1 tâche non visée');
  await expect(failed).toContainText(`Note de frais Kribi — ${REFUSED}`);
  // Un appel par tâche, dans l'ordre, sur la route existante ; pas de toast en double.
  expect(posted).toEqual(['t1 accepted', 't2 accepted', 't3 accepted']);
  await expect(page.getByText(REFUSED)).toHaveCount(1);
  // Reste la tâche en échec, toujours cochée pour relancer.
  await expect(page.getByLabel('Sélectionner « Note de frais Kribi »')).toBeChecked();
  await expect(bulk).toHaveText('Viser la sélection (1)');
});

test('BULK-02 — Given une sélection, When Annuler ou Échap, Then aucun appel', async ({ page, loginAs }) => {
  let posts = 0;
  await page.route(/\/api\/v1\/workflows\/pending/, (route) => json(route, TASKS));
  await page.route(/\/api\/v1\/workflows\/step\/.*\/actions$/, (route) => {
    posts += 1;
    return json(route, {});
  });

  await loginAs('manager');
  await page.goto('tasks');
  await page.getByLabel('Sélectionner « Bordereau mission Garoua »').check();
  const bulk = page.getByTestId('bulk-approve');
  await expect(bulk).toHaveText('Viser la sélection (1)');

  await bulk.click();
  const dialog = page.getByRole('dialog', { name: 'Viser 1 tâche ?' });
  await dialog.getByRole('button', { name: 'Annuler' }).click();
  await expect(dialog).toHaveCount(0);
  await bulk.click();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  expect(posts).toBe(0);
});
