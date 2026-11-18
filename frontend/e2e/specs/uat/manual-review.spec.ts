import { test, expect } from '../../fixtures/uat.fixture';

/**
 * UAT — SC-ADM-07 : traiter les documents à revoir (Administrateur Ministère).
 * Écran réel : /classification-reviews (/needs-review redirige dessus).
 *
 * Pré-condition produite de façon déterministe : un document dont le nom ne correspond à
 * aucune règle active ouvre une revue de classement à l'upload.
 */

test.describe('SC-ADM-07 — Documents à revoir', () => {
  test('ouvrir un document signalé, le requalifier, le marquer résolu : il sort de la file', async ({
    page,
    loginAs,
    adminApi,
    runId,
  }) => {
    const domain = await adminApi.createDomain(`uat-rh-${runId}`, `Ressources humaines UAT ${runId}`);
    const activity = await adminApi.createActivity(domain.id, `uat-paie-${runId}`, `Paie UAT ${runId}`);
    const title = `Note sans règle ${runId}`;
    const doc = await adminApi.uploadDocument(`zz-sans-regle-${runId}.txt`, title, `Contenu à revoir ${runId}`);
    expect(doc.classification_status).not.toBe('classified');
    // Un second dossier garantit qu'il reste une revue ouverte après la résolution.
    await adminApi.uploadDocument(`zz-sans-regle-suite-${runId}.txt`, `Note suivante ${runId}`, `Suite à revoir ${runId}`);

    const reviews = await adminApi.listReviews();
    expect(
      reviews.some((r) => r.document_id === doc.id),
      'une revue est ouverte pour le document non classé',
    ).toBe(true);

    await loginAs('tenant_admin');
    await page.goto('needs-review');
    await expect(page).toHaveURL(/classification-reviews/);

    // Étape 2 : la liste montre le document avec sa raison.
    const row = page.getByRole('button', { name: new RegExp(title) });
    await expect(row).toBeVisible();

    // Étapes 3 à 6 : ouvrir, corriger, commenter, valider.
    await row.click();
    await page.getByLabel('Domaine', { exact: true }).selectOption({ label: domain.name });
    await page.getByLabel('Activité', { exact: true }).selectOption({ label: activity.name });
    await page.getByLabel('Année', { exact: true }).fill('2026');
    await page.getByLabel('Commentaire de résolution').fill(`Requalifié en recette ${runId}`);
    await page.getByRole('button', { name: /Classer et relancer/i }).click();
    await expect(page.getByText(/Classement validé/)).toBeVisible();

    // Étape 7 : le document sort de la file.
    await expect(row).toHaveCount(0);

    // Non-régression (répétition démo, étape 5) : le panneau passe au dossier suivant
    // au lieu de rester sur celui qui vient d'être classé.
    const selectedRow = page.getByRole('button', { pressed: true });
    await expect(selectedRow).toHaveCount(1);
    await expect(selectedRow).not.toContainText(title);
    const nextTitle = (await selectedRow.locator('p').first().innerText()).trim();
    await expect(page.getByRole('heading', { level: 3, name: nextTitle, exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { level: 3, name: title, exact: true })).toHaveCount(0);

    const after = await adminApi.getDocument(doc.id);
    expect(after.classification_status).toBe('classified');
    expect(after.classification_domain_id).toBe(domain.id);
    expect(after.classification_activity_id).toBe(activity.id);
  });
});
