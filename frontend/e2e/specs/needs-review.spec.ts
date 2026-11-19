import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures/authenticated.fixture';

/**
 * SC-ADM-07 — Arbitrage humain des documents non classés
 *
 * Après l'upload massif, les documents que le moteur n'a pas su classer
 * remontent sur /classification-reviews (avec compat /needs-review). Le tenant_admin doit les reprendre un par un
 * pour décider du classement ou confirmer qu'ils restent non classés.
 *
 * Ce spec :
 *   1. ouvre la page et attend le chargement
 *   2. arbitre les 5 premiers documents (domaine, activité et service cible choisis, commentaire fourni)
 *   3. vérifie que la liste diminue à chaque arbitrage
 *
 * Défensif : si la liste est vide (workflow n'a encore rien mis en rebut),
 * le test se contente d'asserter la structure de la page.
 */

const MAX_ARBITRATIONS = 5;

/**
 * Domaine et activité sont obligatoires pour « Classer et relancer » : prend le premier domaine
 * qui a au moins une activité, puis sa première activité ; complète le service cible s'il est vide.
 */
async function fillClassification(page: Page) {
  const domain = page.getByRole('combobox', { name: 'Domaine' });
  const activity = page.getByRole('combobox', { name: 'Activité' });
  const domainCount = await domain.locator('option').count();
  for (let d = 1; d < domainCount; d += 1) {
    await domain.selectOption({ index: d });
    if ((await activity.locator('option').count()) > 1) break;
  }
  await activity.selectOption({ index: 1 });

  const target = page.getByRole('combobox', { name: 'Service cible' });
  if ((await target.isVisible()) && !(await target.inputValue())) {
    await target.selectOption({ index: 1 });
  }
}

test.describe.serial('Feature: Arbitrage Documents à revoir (SC-ADM-07)', () => {

  test('Given tenant_admin, When /needs-review, Then la page charge', async ({ page }) => {
    await page.goto('needs-review');
    await page.waitForLoadState('networkidle');

    const heading = page.getByText(/revue de classement|documents à revoir|needs review|à revoir|classement manuel/i).first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  test('SC-ADM-07 — arbitrage séquentiel des documents en rebut', async ({ page }) => {
    await page.goto('needs-review');
    await page.waitForLoadState('networkidle');

    // Liste des documents en rebut — on cible les lignes cliquables
    const docRows = page.getByRole('button').filter({ has: page.locator('span.material-symbols-outlined:text("warning")') });
    const initialCount = await docRows.count().catch(() => 0);

    if (initialCount === 0) {
      test.info().annotations.push({
        type: 'skip-reason',
        description: 'liste vide — aucun document en attente d\'arbitrage',
      });
      return;
    }

    console.log(`[needs-review] ${initialCount} documents en rebut au départ`);

    const arbitrations = Math.min(initialCount, MAX_ARBITRATIONS);
    let resolved = 0;

    for (let i = 0; i < arbitrations; i++) {
      const current = docRows.first();
      if (!(await current.isVisible().catch(() => false))) break;

      await current.click();

      // Commentaire pour tracer la décision
      const commentField = page.getByRole('textbox', { name: 'Commentaire de résolution' });
      await expect(commentField).toBeVisible({ timeout: 5_000 });
      await fillClassification(page);
      await commentField.fill(`Arbitrage E2E ${Date.now()} — classé par l'arbitrage`);

      // Bouton valider l'arbitrage : actif une fois le formulaire complet
      const resolveBtn = page.getByRole('button', { name: /classer et relancer/i });
      await expect(resolveBtn).toBeEnabled({ timeout: 5_000 });

      // Intercepter l'appel API pour confirmer la résolution côté réseau
      const responsePromise = page.waitForResponse(
        (r) => /\/classification-reviews\/[^/]+\/resolve/.test(r.url()) && r.request().method() === 'POST',
        { timeout: 10_000 },
      );
      await resolveBtn.click();
      const res = await responsePromise.catch(() => null);
      if (!res || !res.ok()) {
        console.log(`[needs-review] échec résolution ${i} :`, res?.status());
        break;
      }

      resolved++;
      await page.waitForLoadState('networkidle');
    }

    console.log(`[needs-review] ${resolved} arbitrages effectués`);
    expect(resolved).toBeGreaterThan(0);

    // La liste doit avoir diminué
    const finalCount = await docRows.count().catch(() => 0);
    expect(finalCount).toBeLessThanOrEqual(initialCount - resolved);
  });
});
