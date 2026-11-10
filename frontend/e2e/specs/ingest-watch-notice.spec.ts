import { test, expect } from '../fixtures/auth.fixture';

/**
 * Lot 5 (SC-V11-05, volet écran) : l'encart « Surveillance » de l'écran
 * Ingestion reflète l'état renvoyé par GET /documents/ingest-watch/status
 * (réponse simulée).
 */
const statusRoute = '**/documents/ingest-watch/status';

test.describe('Feature: encart Surveillance', () => {
  test('Given surveillance active, When écran Ingestion, Then dernier passage affiché', async ({ loginAs, page }) => {
    await page.route(statusRoute, (route) =>
      route.fulfill({
        json: {
          enabled: true,
          interval_seconds: 60,
          last_run: {
            at: '2026-11-10T09:30:00+00:00',
            folders: [{ path: '/data/ingest/surveille', found: 3, imported: 2, skipped: 1, errors: 0 }],
          },
        },
      }),
    );
    await loginAs('tenant_admin');
    await page.goto('ingestion');
    const notice = page.getByTestId('ingest-watch-notice');
    await expect(notice).toBeVisible({ timeout: 10_000 });
    await expect(notice).toContainText('surveille');
    await expect(notice).toContainText('2 importés');
    await expect(notice).toContainText('1 ignoré');
  });

  test('Given surveillance désactivée, When écran Ingestion, Then message de désactivation', async ({ loginAs, page }) => {
    await page.route(statusRoute, (route) =>
      route.fulfill({ json: { enabled: false, interval_seconds: 0, last_run: null } }),
    );
    await loginAs('tenant_admin');
    await page.goto('ingestion');
    await expect(page.getByTestId('ingest-watch-notice')).toContainText('Surveillance désactivée', { timeout: 10_000 });
  });
});
