import type { Route } from '@playwright/test';
import { test, expect } from '../../fixtures/uat.fixture';

/**
 * Fenêtre de confirmation partagée (ConfirmationModal), vue sur l'Espace Manager :
 * focus sur « Annuler » à l'ouverture, Tab reste dans la fenêtre, Échap ferme, focus rendu au bouton d'origine.
 * Réponse simulée : une tâche à viser.
 */

const TASK = {
  id: 'cm-1',
  document_id: 'doc-cm-1',
  step_order: 1,
  label: 'Visa du chef de service',
  assigned_to: null,
  status: 'current',
  expected_action_type: 'visa',
  completed_at: null,
  comment: null,
  created_at: '2026-11-19T08:00:00Z',
  document: { id: 'doc-cm-1', title: 'Bordereau focus clavier', status: 'in_review', current_version_id: 'ver-cm-1', created_at: '2026-11-19T08:00:00Z' },
};

const json = (route: Route, body: unknown) =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

test('CM-FOCUS-01 — Given confirmation ouverte au clavier, When Tab puis Échap, Then focus gardé puis rendu', async ({ page, loginAs }) => {
  let posts = 0;
  await page.route(/\/api\/v1\/workflows\/pending/, (route) => json(route, [TASK]));
  await page.route(/\/api\/v1\/workflows\/step\/.*\/actions$/, (route) => {
    posts += 1;
    return json(route, {});
  });

  await loginAs('manager');
  const open = page.getByRole('button', { name: 'Viser', exact: true });
  await expect(open).toBeVisible({ timeout: 10_000 });
  await open.focus();
  await page.keyboard.press('Enter');

  const dialog = page.getByRole('dialog', { name: 'Viser' });
  const cancel = dialog.getByRole('button', { name: 'Annuler' });
  const confirm = dialog.getByRole('button', { name: 'Confirmer' });
  // Choix sûr : Entrée par réflexe n'envoie rien.
  await expect(cancel).toBeFocused();

  await page.keyboard.press('Tab');
  await expect(confirm).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(cancel).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(confirm).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(open).toBeFocused();
  expect(posts).toBe(0);
});
