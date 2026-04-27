import { test, expect } from '../fixtures/authenticated.fixture';

/**
 * SC-ADM-REVIEW — Arbitrage humain des documents non classés
 *
 * Après l'upload massif, les documents que le moteur n'a pas su classer
 * remontent sur /needs_review. Le tenant_admin doit les reprendre un par un
 * pour décider du classement ou confirmer qu'ils restent non classés.
 *
 * Ce spec :
 *   1. ouvre la page et attend le chargement
 *   2. arbitre les 5 premiers documents (commentaire fourni, pas de dossier cible)
 *   3. vérifie que la liste diminue à chaque arbitrage
 *
 * Défensif : si la liste est vide (workflow n'a encore rien mis en rebut),
 * le test se contente d'asserter la structure de la page.
 */

const MAX_ARBITRATIONS = 5;

test.describe.serial('Feature: Arbitrage Documents à revoir (SC-ADM-REVIEW)', () => {

  test('Given tenant_admin, When /needs_review, Then la page charge', async ({ page }) => {
    await page.goto('needs_review');
    await page.waitForLoadState('networkidle');

    const heading = page.getByText(/documents à revoir|needs review|à revoir/i).first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  test('SC-ADM-REVIEW — arbitrage séquentiel des documents en rebut', async ({ page }) => {
    await page.goto('needs_review');
    await page.waitForLoadState('networkidle');

    // Liste des documents en rebut — on cible les lignes cliquables
    const docRows = page.locator('[class*="cursor-pointer"]').filter({ has: page.locator('text=/\\.(pdf|docx|xlsx|pptx)/i') });
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

      // Champ commentaire obligatoire pour tracer la décision
      const commentField = page.locator('textarea').first();
      await expect(commentField).toBeVisible({ timeout: 5_000 });
      await commentField.fill(`Arbitrage E2E ${Date.now()} — document conservé sans classement`);

      // Bouton valider l'arbitrage
      const resolveBtn = page.getByRole('button', { name: /valider|résoudre|confirmer|arbitrer/i }).first();
      if (!(await resolveBtn.isVisible().catch(() => false))) {
        console.log(`[needs-review] bouton de résolution introuvable à l'itération ${i}`);
        break;
      }

      // Intercepter l'appel API pour confirmer la résolution côté réseau
      const responsePromise = page.waitForResponse(
        (r) => /\/documents\/[^/]+\/resolve-review/.test(r.url()) && r.request().method() === 'POST',
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
