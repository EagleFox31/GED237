import { test, expect } from '../../fixtures/auth.fixture';
import { SEED } from '../../data/seed';

/**
 * P8 - Cycle de validation, version réelle (SC-VAL-01..03, SC-VAL-04 réduit).
 * Remplace validation.spec.ts / workflow.spec.ts (défensifs, tout en skip) ; matrice-recette.md lignes SC-VAL.
 *
 * Données : les 3 tâches `E2E-VAL-*` du manager MGR001 (seed-manifest.json, circuit E2E-WF-VALID).
 * Les tâches sont consommées : une pile fraîche (reset e2e) est nécessaire à chaque run.
 *
 * SC-VAL-04 est réduit (écart 17, « Retourner pour correction » -> V1.1) : le rédacteur voit le statut Rejeté
 * de son document ; SC-VAL-04b vérifie le motif dans le détail du document (/documents, onglet Circuit de Validation).
 */

const task = (code: string) => {
  const doc = SEED.documents.find((d) => d.code === code);
  if (!doc) throw new Error(`${code} is not in seed-manifest.json`);
  return doc.title;
};
const TO_APPROVE = task('E2E-VAL-VISA');
const TO_REJECT = task('E2E-VAL-REJET');
const REASON = 'Merci de préciser la référence budgétaire';

test.describe.serial('Feature: Cycle de validation (SC-VAL-01..04)', () => {
  test.slow(); // several logins and API round trips per test

  const card = (page: import('@playwright/test').Page, title: string) =>
    page.locator('.grid > div').filter({ hasText: title });

  // The manager session from beforeEach would hide the login form: drop it before changing user.
  const switchTo = async (
    page: import('@playwright/test').Page,
    loginAs: (role: 'collaborator') => Promise<void>,
  ) => {
    await page.context().clearCookies();
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await loginAs('collaborator');
  };

  test.beforeEach(async ({ loginAs, page }) => {
    await loginAs('manager');
    await page.goto('tasks');
  });

  test('SC-VAL-01 - Given manager, When /tasks, Then les 3 tâches du circuit sont en pile', async ({ page }) => {
    for (const code of ['E2E-VAL-VISA', 'E2E-VAL-REJET', 'E2E-VAL-RETOUR']) {
      await expect(card(page, task(code))).toBeVisible();
    }
  });

  test('SC-VAL-02 - Given une tâche, When Valider, Then elle quitte la pile sans erreur', async ({ page }) => {
    await card(page, TO_APPROVE).getByRole('button', { name: 'Valider' }).click();
    await expect(card(page, TO_APPROVE)).toHaveCount(0);
  });

  test('SC-VAL-03 - Given Rejeter, When motif vide puis motif saisi, Then confirmation bloquée puis tâche traitée', async ({ page }) => {
    await card(page, TO_REJECT).getByRole('button', { name: 'Rejeter' }).click();
    const dialog = page.getByRole('dialog', { name: 'Rejeter le document' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Confirmer le rejet' })).toBeDisabled();

    await dialog.getByLabel('Motif du rejet').fill(REASON);
    await dialog.getByRole('button', { name: 'Confirmer le rejet' }).click();
    await expect(dialog).toBeHidden();
    await expect(card(page, TO_REJECT)).toHaveCount(0);
  });

  test('SC-VAL-04 (réduit) - Given document rejeté, When le rédacteur ouvre son espace, Then le statut Rejeté est visible', async ({ loginAs, page }) => {
    await switchTo(page, loginAs);
    await expect(page.locator('.grid > div').filter({ hasText: TO_REJECT }).getByText(/^(rejected|rejeté)$/i)).toBeVisible(); // tolère le libellé brut jusqu au correctif F
  });

  test('SC-VAL-04b - Given document rejeté, When le rédacteur ouvre son détail, Then le motif est visible dans le circuit', async ({ loginAs, page }) => {
    // The reason is shown in the document detail (DocumentDetailModal, tab "Circuit de Validation"), not in the Atelier card.
    await switchTo(page, loginAs);
    await page.goto('documents');
    await page.getByText(TO_REJECT).first().click();
    await page.getByText('Circuit de Validation').click();
    // The reason appears on the step and again in the action history: both are expected.
    await expect(page.getByText(`"${REASON}"`).first()).toBeVisible();
  });
});
