import { test, expect } from '../../fixtures/uat.fixture';

/**
 * Lot 13 (V1.1) — « Mes dernières actions » : sans accès au journal, l'utilisateur retrouve
 * ses propres actions depuis le menu, sans export ni colonne d'auteur.
 */
test.describe('Mes dernières actions', () => {
  test('le collaborateur ouvre ses actions depuis le menu', async ({ page, loginAs }) => {
    await loginAs('collaborator');
    await page.getByRole('navigation').getByRole('button', { name: /Mes actions$/ }).click();

    await expect(page).toHaveURL(/\/my-actions$/);
    await expect(page.getByRole('heading', { name: 'Mes dernières actions' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Exporter \(CSV\)/ })).toHaveCount(0);
    await expect(page.getByText('Impossible de charger le registre des actions.')).toHaveCount(0);
  });

  test('le lecteur ouvre /my-actions par URL, sans export', async ({ page, loginAs }) => {
    await loginAs('reader');
    await page.goto('my-actions');

    await expect(page).toHaveURL(/\/my-actions$/);
    await expect(page.getByRole('heading', { name: 'Mes dernières actions' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Exporter \(CSV\)/ })).toHaveCount(0);
  });

  test('l’auditeur garde le registre complet et l’export', async ({ page, loginAs }) => {
    await loginAs('auditor');
    await page.goto('audit');

    await expect(page.getByRole('heading', { name: 'Registre Des Actions' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Exporter \(CSV\)/ })).toBeVisible();
  });
});
