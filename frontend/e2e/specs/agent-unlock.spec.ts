import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures/auth.fixture';

/**
 * #135 — « Débloquer » dans la fiche agent (Agents & rôles), session tenant_admin.
 *
 *   - UNLOCK-01 : compte non verrouillé, vrai serveur → POST /users/{id}/unlock, message « pas verrouillé ».
 *   - UNLOCK-02 : compte verrouillé (réponse serveur simulée) → message de succès.
 *
 * Verrouiller réellement un compte demanderait plusieurs connexions OTP fausses sur un compte partagé
 * par les autres specs : le cas verrouillé est donc simulé ; le contrat serveur est couvert par
 * backend/tests/api/test_auth_otp_lockout.py.
 */
const AGENT = 'READ001';

async function openAgent(page: Page) {
  await page.goto(`users?q=${AGENT}`);
  const row = page.getByRole('button', { name: new RegExp(AGENT) }).first();
  await expect(row).toBeVisible({ timeout: 15_000 });
  await row.click();
  await expect(page.getByRole('button', { name: /Débloquer/ })).toBeVisible();
}

test.describe('Fiche agent : débloquer un compte (#135)', () => {
  test.beforeEach(async ({ loginAs }) => {
    await loginAs('tenant_admin');
  });

  test('UNLOCK-01 — compte non verrouillé : le serveur le dit, rien ne change', async ({ page }) => {
    await openAgent(page);
    const call = page.waitForRequest((r) => r.method() === 'POST' && /\/users\/[^/]+\/unlock$/.test(r.url()));
    await page.getByRole('button', { name: /Débloquer/ }).click();
    expect((await call).postData() ?? '').toBe('');
    await expect(page.getByText('Ce compte n\'est pas verrouillé.')).toBeVisible();
  });

  test('UNLOCK-02 — compte verrouillé : message de succès du serveur', async ({ page }) => {
    await page.route(/\/users\/[^/]+\/unlock$/, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ unlocked: true, message: 'Compte débloqué : l\'agent peut se reconnecter.' }),
      }),
    );
    await openAgent(page);
    await page.getByRole('button', { name: /Débloquer/ }).click();
    await expect(page.getByText('Compte débloqué : l\'agent peut se reconnecter.')).toBeVisible();
  });
});
