import { test, expect } from '../fixtures/auth.fixture';

/**
 * Feature: Audit Logs (auditor)
 *
 * Couvre la page /audit rebranchée en P7 sur GET /audit/logs.
 * Vérifie :
 *   - Chargement initial via le vrai endpoint (pas le proxy notifications)
 *   - Filtrage par table_name et action (query params propagés)
 */
test.describe('Feature: Audit Logs', () => {

  test('Given auditor, When open /audit, Then GET /audit/logs is called', async ({ loginAs, page }) => {
    await loginAs('auditor');

    const logsPromise = page.waitForResponse(
      r => /\/audit\/logs/.test(r.url()) && r.request().method() === 'GET',
      { timeout: 10_000 },
    );
    await page.goto('audit');
    const response = await logsPromise;

    expect(response.status()).toBe(200);
    await expect(page.getByRole('heading', { name: /compliance|audit/i }).first()).toBeVisible();
  });

  test('Given /audit, When select table=documents, Then request carries table_name param', async ({ loginAs, page }) => {
    await loginAs('auditor');
    await page.goto('audit');

    const filteredCall = page.waitForRequest(r => /\/audit\/logs\?.*table_name=documents/.test(r.url()));
    await page.locator('select').first().selectOption('documents');
    const req = await filteredCall;
    expect(req.url()).toMatch(/table_name=documents/);
  });

  test('Given /audit, When select action=create, Then request carries action param', async ({ loginAs, page }) => {
    await loginAs('auditor');
    await page.goto('audit');

    const filteredCall = page.waitForRequest(r => /\/audit\/logs\?.*action=create/.test(r.url()));
    await page.locator('select').nth(1).selectOption('create');
    const req = await filteredCall;
    expect(req.url()).toMatch(/action=create/);
  });
});
