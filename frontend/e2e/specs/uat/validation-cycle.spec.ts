import type { Page } from '@playwright/test';
import { test, expect, apiAs } from '../../fixtures/uat.fixture';

/**
 * P8 - Cycle de validation, version réelle (SC-VAL-01..03, SC-VAL-04 réduit).
 * Remplace validation.spec.ts / workflow.spec.ts (défensifs, tout en skip) ; matrice-recette.md lignes SC-VAL.
 *
 * Données : chaque passage crée ses 3 tâches (le collaborateur MINFI002 dépose 3 documents uniques et les soumet
 * au visa du manager MGR001). Les tâches E2E-VAL-* du seed ne sont plus consommées : seed.spec et les autres specs
 * les retrouvent intactes, quel que soit l'ordre de lancement, et la spec se rejoue sans remise à zéro.
 *
 * SC-VAL-02/03 retiennent l'envoi de la décision pour vérifier les libellés d'attente (audit UX lot 6, point 2).
 *
 * SC-VAL-04 est réduit (écart 17, « Retourner pour correction » -> V1.1) : le rédacteur voit le statut Rejeté
 * de son document ; SC-VAL-04b vérifie le motif dans le détail du document (/documents, onglet Circuit de Validation).
 */

const REASON = 'Merci de préciser la référence budgétaire';

test.describe.serial('Feature: Cycle de validation (SC-VAL-01..04)', () => {
  test.slow(); // several logins and API round trips per test

  // Titles of this run's tasks, set in beforeAll (a retry of the serial group gets new ones).
  let TO_APPROVE = '';
  let TO_REJECT = '';
  let TO_RETURN = '';

  test.beforeAll(async ({ playwright }, testInfo) => {
    const request = await playwright.request.newContext();
    try {
      const owner = await apiAs(request, 'collaborator');
      const managerId = (await (await apiAs(request, 'manager')).me()).id;
      const run = `${Date.now().toString(36)}${testInfo.workerIndex}${testInfo.retry}`;
      let n = 0;
      const submit = async (kind: string): Promise<string> => {
        const title = `[E2E ${run}] Bordereau ${kind}`;
        const doc = await owner.uploadDocument(`val-${run}-${n++}.txt`, title, `Cycle de validation ${title}`);
        await owner.submitForVisa(doc.id, managerId, 'Visa du manager');
        return title;
      };
      TO_APPROVE = await submit('à viser');
      TO_REJECT = await submit('à rejeter');
      TO_RETURN = await submit('à retourner');
    } finally {
      await request.dispose();
    }
  });

  const card = (page: Page, title: string) => page.locator('.grid > div').filter({ hasText: title });

  // Retient la décision envoyée au serveur (réseau lent) jusqu'à release() : le libellé d'attente reste observable.
  const holdDecision = async (page: Page) => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    await page.route('**/workflows/step/*/actions', async (route) => { await gate; await route.continue(); });
    return release;
  };

  // The manager session from beforeEach would hide the login form: drop it before changing user.
  const switchTo = async (page: Page, loginAs: (role: 'collaborator') => Promise<void>) => {
    await page.context().clearCookies();
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await loginAs('collaborator');
  };

  test.beforeEach(async ({ loginAs, page }) => {
    await loginAs('manager');
    await page.goto('tasks');
  });

  test('SC-VAL-01 - Given manager, When /tasks, Then les 3 tâches du circuit sont en pile', async ({ page }) => {
    for (const title of [TO_APPROVE, TO_REJECT, TO_RETURN]) {
      await expect(card(page, title)).toBeVisible();
    }
  });

  test('SC-VAL-02 - Given une tâche, When Valider, Then « Validation… » pendant l’envoi puis elle quitte la pile', async ({ page }) => {
    const release = await holdDecision(page);
    await card(page, TO_APPROVE).getByRole('button', { name: 'Valider' }).click();
    // Audit lot 6, point 2 : sur réseau lent, le bouton dit qu'il travaille.
    await expect(card(page, TO_APPROVE).getByRole('button', { name: 'Validation…' })).toBeDisabled();
    release();
    await expect(card(page, TO_APPROVE)).toHaveCount(0);
  });

  test('SC-VAL-03 - Given Rejeter, When motif vide puis motif saisi, Then confirmation bloquée puis tâche traitée', async ({ page }) => {
    await card(page, TO_REJECT).getByRole('button', { name: 'Rejeter' }).click();
    const dialog = page.getByRole('dialog', { name: 'Rejeter le document' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Confirmer le rejet' })).toBeDisabled();

    await dialog.getByLabel('Motif du rejet').fill(REASON);
    const release = await holdDecision(page);
    await dialog.getByRole('button', { name: 'Confirmer le rejet' }).click();
    await expect(dialog.getByRole('button', { name: 'Envoi…' })).toBeDisabled();
    await expect(card(page, TO_REJECT).getByRole('button', { name: 'Rejet…' })).toBeDisabled();
    release();
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
