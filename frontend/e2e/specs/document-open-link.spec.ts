import { test, expect } from '../fixtures/auth.fixture';

test.describe('Lien vers une fiche introuvable (#263)', () => {
  /**
   * SCENARIO: lien ?open= vers un document inexistant ou hors périmètre
   *
   *   GIVEN  un admin connecté
   *   WHEN   il ouvre /documents?open=<id inconnu>
   *   THEN   un message court s'affiche (pas le texte du serveur)
   *   AND    `open` disparaît de l'URL et la liste reste affichée
   */
  test('Given lien vers un id inconnu, When ouverture, Then message clair et URL nettoyée', async ({ page, loginAs }) => {
    await loginAs('tenant_admin');

    await page.goto('documents?open=00000000-0000-4000-8000-000000000000');

    await expect(page.getByText("Ce document n'existe pas ou ne vous est pas accessible.")).toBeVisible({ timeout: 10_000 });
    await expect(page).not.toHaveURL(/[?&]open=/);
    await expect(page.getByText(/not found/i)).toHaveCount(0);
  });
});
