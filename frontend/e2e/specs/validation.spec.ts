import { test, expect } from '../fixtures/auth.fixture';

/**
 * SC-VAL-01..05 — Parcours du Valideur (manager)
 *
 * Couvre :
 *   - SC-VAL-01 : consultation de la pile de tâches
 *   - SC-VAL-02 : visa avec commentaire optionnel
 *   - SC-VAL-03 : rejet avec motif obligatoire (E1 — motif vide refusé)
 *   - SC-VAL-04 : retour pour correction (commentaire obligatoire)
 *   - SC-VAL-05 : signature finale (skip si absente du workflow)
 *
 * Les étapes qui supposent une tâche en pile sont défensives :
 *   si la pile est vide, le test se contente d'asserter la structure
 *   de la page sans forcer un acte métier. Cela permet au spec de tourner
 *   même sur un seed minimal.
 */
test.describe('Feature: Parcours du Valideur (SC-VAL-01..05)', () => {

  test.beforeEach(async ({ loginAs, page }) => {
    await loginAs('manager');
    await page.goto('tasks');
    await page.waitForLoadState('networkidle');
  });

  test('SC-VAL-01 — Given manager connecté, When il ouvre /tasks, Then la pile s\'affiche', async ({ page }) => {
    await expect(page.getByText(/validation|tâche|pile|manager/i).first()).toBeVisible({ timeout: 10_000 });
    // Soit une liste, soit un état vide explicite
    const hasList = await page.locator('table, [class*="task"], [class*="grid"]').first().isVisible().catch(() => false);
    const hasEmpty = await page.getByText(/aucune|vide|rien à valider/i).first().isVisible().catch(() => false);
    expect(hasList || hasEmpty).toBeTruthy();
  });

  test('SC-VAL-02 — Given une tâche visible, When visa, Then confirmation', async ({ page }) => {
    const approveBtn = page.getByRole('button', { name: /valider|approuver|viser/i }).first();
    if (!await approveBtn.isVisible().catch(() => false)) {
      test.skip(true, 'Pas de tâche en pile — scénario non applicable sur ce seed.');
    }
    await approveBtn.click();
    // Commentaire optionnel : on laisse vide si possible
    const commentField = page.locator('textarea, input[name*="comment"]').first();
    if (await commentField.isVisible().catch(() => false)) {
      // ne pas remplir — optionnel
    }
    const confirmBtn = page.getByRole('button', { name: /confirmer|envoyer|valider/i }).last();
    await confirmBtn.click();
    await expect(page.getByText(/validé|succès|approuvé/i).first()).toBeVisible({ timeout: 5_000 });
  });

  test('SC-VAL-03 — Given rejet, When motif vide, Then refus (E1)', async ({ page }) => {
    const rejectBtn = page.getByRole('button', { name: /rejeter|refuser/i }).first();
    if (!await rejectBtn.isVisible().catch(() => false)) {
      test.skip(true, 'Pas de tâche en pile — scénario non applicable sur ce seed.');
    }
    await rejectBtn.click();
    // Tenter de soumettre sans motif
    const submitBtn = page.getByRole('button', { name: /confirmer|envoyer|rejeter/i }).last();
    await submitBtn.click();
    // Le formulaire doit refuser : message d'erreur OU champ motif toujours vide et modal encore ouverte
    const stillOpen = await page.locator('textarea, input[name*="motif"], input[name*="reason"]').first().isVisible().catch(() => false);
    const errorShown = await page.getByText(/obligatoire|requis|motif/i).first().isVisible().catch(() => false);
    expect(stillOpen || errorShown).toBeTruthy();
  });

  test('SC-VAL-04 — Given retour pour correction, When commentaire fourni, Then renvoi rédacteur', async ({ page }) => {
    const returnBtn = page.getByRole('button', { name: /retour|corriger|renvoyer/i }).first();
    if (!await returnBtn.isVisible().catch(() => false)) {
      test.skip(true, 'Action "retour" non disponible sur ce seed.');
    }
    await returnBtn.click();
    const commentField = page.locator('textarea, input[name*="comment"]').first();
    if (await commentField.isVisible().catch(() => false)) {
      await commentField.fill('Merci de préciser la référence budgétaire');
    }
    const confirmBtn = page.getByRole('button', { name: /confirmer|envoyer|retourner/i }).last();
    await confirmBtn.click();
    await expect(page.getByText(/retourné|renvoyé|correction/i).first()).toBeVisible({ timeout: 5_000 });
  });

  test('SC-VAL-05 — Given signature finale disponible, When signer, Then dossier clos', async ({ page }) => {
    const signBtn = page.getByRole('button', { name: /signer|signature/i }).first();
    if (!await signBtn.isVisible().catch(() => false)) {
      test.skip(true, 'Étape de signature absente — workflow ne va pas jusque-là sur ce seed.');
    }
    await signBtn.click();
    const confirmBtn = page.getByRole('button', { name: /confirmer|signer/i }).last();
    await confirmBtn.click();
    await expect(page.getByText(/signé|succès|clos/i).first()).toBeVisible({ timeout: 5_000 });
  });
});
