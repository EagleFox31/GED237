import type { Route } from '@playwright/test';
import { test, expect } from '../../fixtures/auth.fixture';

/**
 * Audit « parcours réel du fonctionnaire », friction 2 : un document rejeté ne doit pas être
 * un cul-de-sac dans « Mon Atelier ». La carte montre le motif et propose « Corriger et resoumettre ».
 * Réponses simulées : on vérifie ce que l'écran affiche et envoie.
 */

const REASON = 'Pièce jointe manquante : ajoutez le devis signé.';
const VALIDATOR = { id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', full_name: 'Chef de Service', email: 'chef@example.cm', role: 'manager' };
const REJECTED = {
  id: 'r-1',
  title: 'Note de frais mission Garoua',
  status: 'rejected',
  tags: [],
  created_at: '2026-11-19T08:00:00Z',
  updated_at: '2026-11-19T09:00:00Z',
};
const DRAFT = { ...REJECTED, id: 'd-1', title: 'Brouillon sans circuit', status: 'draft' };

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

test.describe('Mon Atelier : document rejeté', () => {
  test('ATL-01 — Given document rejeté, When Mon Atelier, Then motif visible, version corrigée puis resoumission', async ({ loginAs, page }) => {
    const calls: string[] = [];

    await page.route(/\/api\/v1\/documents\/?(\?|$)/, (route) => json(route, [REJECTED, DRAFT]));
    await page.route(/\/api\/v1\/documents\/r-1\/?(\?|$)/, (route) =>
      json(route, { ...REJECTED, last_rejection_reason: REASON }),
    );
    await page.route(/\/api\/v1\/documents\/r-1\/versions$/, (route) => {
      calls.push(`${route.request().method()} versions`);
      return json(route, { id: 'v-2' }, 201);
    });
    await page.route(/\/api\/v1\/workflows\/validators/, (route) => json(route, [VALIDATOR]));
    await page.route(/\/api\/v1\/workflows\/document\/r-1\/steps/, (route) => {
      calls.push(`${route.request().method()} steps ${route.request().postData()}`);
      return json(route, []);
    });

    await loginAs('collaborator');
    await expect(page.getByText('Mon Atelier')).toBeVisible({ timeout: 10_000 });

    const card = page.getByTestId('draft-card').filter({ hasText: REJECTED.title });
    await expect(card.getByTestId('rejection-reason')).toContainText(REASON);
    // Le brouillon garde « Soumettre » et n'affiche ni motif ni « Corriger ».
    const draftCard = page.getByTestId('draft-card').filter({ hasText: DRAFT.title });
    await expect(draftCard.getByRole('button', { name: 'Soumettre' })).toBeVisible();
    await expect(draftCard.getByRole('button', { name: 'Corriger et resoumettre' })).toHaveCount(0);

    await card.getByRole('button', { name: 'Corriger et resoumettre' }).click();
    await expect(page.getByRole('heading', { name: 'Corriger et resoumettre' })).toBeVisible();
    await page.getByLabel('Fichier corrigé (facultatif)').setInputFiles({
      name: 'note-corrigee.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 corrigé'),
    });
    await page.locator('select').selectOption(VALIDATOR.id);
    await page.getByRole('button', { name: 'Resoumettre au visa' }).click();

    await expect(page.getByRole('heading', { name: 'Corriger et resoumettre' })).toHaveCount(0);
    // La version corrigée part avant la nouvelle soumission.
    expect(calls[0]).toBe('POST versions');
    expect(calls[1]).toMatch(/^POST steps .*"assigned_to":"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"/);
  });
});
