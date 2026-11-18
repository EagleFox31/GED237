import { test, expect } from '../../fixtures/uat.fixture';
import type { Page } from '@playwright/test';

/**
 * Lot 13 (V1.1) — accueil : « N documents à corriger » mène à la liste filtrée,
 * et la tuile « Mes visas » de l'admin compte ses propres tâches, pas celles du ministère.
 * Les compteurs sont simulés pour ne pas dépendre de l'état partagé du tenant.
 */
async function mockCounters(page: Page, counters: { rejected: number; returned: number; tasks: number }) {
  await page.route('**/workflows/my-counters', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(counters) }),
  );
}

test.describe('Accueil : documents à corriger et mes visas', () => {
  test('le collaborateur voit ses documents à corriger et ouvre la liste filtrée', async ({ page, loginAs }) => {
    await mockCounters(page, { rejected: 2, returned: 1, tasks: 0 });
    await loginAs('collaborator');
    await page.goto('dashboard');

    const banner = page.getByTestId('to-fix-banner');
    await expect(banner).toContainText('3 documents à corriger');
    await banner.click();
    await expect(page).toHaveURL(/\/documents\?status=to_fix$/);
  });

  test('rien à corriger : pas de bandeau', async ({ page, loginAs }) => {
    await mockCounters(page, { rejected: 0, returned: 0, tasks: 2 });
    await loginAs('collaborator');
    await page.goto('dashboard');

    await expect(page.getByRole('heading').first()).toBeVisible();
    await expect(page.getByTestId('to-fix-banner')).toHaveCount(0);
  });

  test('le lecteur ne dépose pas : pas de bandeau, même avec un compteur', async ({ page, loginAs }) => {
    await mockCounters(page, { rejected: 1, returned: 0, tasks: 0 });
    await loginAs('reader');
    await page.goto('dashboard');

    await expect(page.getByRole('heading').first()).toBeVisible();
    await expect(page.getByTestId('to-fix-banner')).toHaveCount(0);
  });

  test('l\'admin voit ses visas à part de ceux du ministère et ouvre ses tâches', async ({ page, loginAs }) => {
    await mockCounters(page, { rejected: 0, returned: 0, tasks: 4 });
    await loginAs('tenant_admin');
    await page.goto('dashboard');

    await expect(page.getByText('Visas en cours (ministère)', { exact: true })).toBeVisible();
    const tile = page.getByText('Mes visas', { exact: true }).locator('..');
    await expect(tile.getByRole('heading', { level: 4 })).toHaveText('4');
    await expect(tile).toContainText('Documents vous attendent');
    await tile.getByRole('button', { name: 'Ouvrir mes tâches' }).click();
    await expect(page).toHaveURL(/\/tasks$/);
  });

  test('sans simulation, la tuile lit le vrai compteur sans alerte', async ({ page, loginAs }) => {
    await loginAs('tenant_admin');
    await page.goto('dashboard');

    const tile = page.getByText('Mes visas', { exact: true }).locator('..');
    await expect(tile.getByRole('heading', { level: 4 })).toHaveText(/^\d+$/);
    await expect(page.getByText('Récupération de vos compteurs impossible')).toHaveCount(0);
  });
});
