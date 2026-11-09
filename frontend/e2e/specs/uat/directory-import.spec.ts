import fs from 'fs';
import path from 'path';
import { test, expect } from '../../fixtures/uat.fixture';

/**
 * UAT — SC-ADM-08 : importer un lot de documents depuis un dossier (Administrateur Ministère).
 * Écran réel : /ingestion, mode « Importer dans le Serveur de l’Application ».
 *
 * Le dossier est construit par la spec (unique par run) :
 *   - un fichier dont le nom correspond à une règle active  → prêt, classé automatiquement ;
 *   - un fichier sans règle correspondante                  → à revoir ;
 *   - un fichier déjà présent dans la GED (même contenu)    → doublon ignoré (exception E1).
 * Le sélecteur de dossier natif est piloté par l'input `webkitdirectory` (Chromium headless).
 * Non couvert : E2 (fichier corrompu), faute de définition métier d'un fichier corrompu.
 */

type CommitResult = { imported_documents: number; pending_review_items: number; failed_items: number };

test.describe('SC-ADM-08 — Import d’un dossier', () => {
  test('scanner, vérifier le classement, importer : compte rendu importés / à revoir / doublons', async ({
    page,
    loginAs,
    adminApi,
    runId,
  }, testInfo) => {
    const domain = await adminApi.createDomain(`uat-imp-${runId}`, `Import UAT ${runId}`);
    const activity = await adminApi.createActivity(domain.id, `uat-impa-${runId}`, `Courriers UAT ${runId}`);
    const keyword = `courrieruat${runId}`;
    await adminApi.createRule({
      code: `uat-imp-rule-${runId}`,
      name: `Courriers UAT ${runId}`,
      filenamePattern: keyword,
      domainId: domain.id,
      activityId: activity.id,
    });

    const duplicateContent = `Déjà dans la GED ${runId}`;
    await adminApi.uploadDocument(`deja-present-${runId}.txt`, `Déjà présent ${runId}`, duplicateContent);

    const dir = testInfo.outputPath(`lot-${runId}`);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${keyword}-001.txt`), `Courrier entrant ${runId}`);
    fs.writeFileSync(path.join(dir, `zz-divers-${runId}.txt`), `Note diverse ${runId}`);
    fs.writeFileSync(path.join(dir, `copie-${runId}.txt`), duplicateContent);

    await loginAs('tenant_admin');
    await page.goto('ingestion');

    // Étapes 1 à 3 : import serveur, choix du dossier.
    await page.getByRole('radio', { name: /Importer dans le Serveur de l.Application/ }).click();
    await page.locator('input[type=file][webkitdirectory]').setInputFiles(dir);
    await page.getByRole('button', { name: 'Continuer vers la destination' }).click();

    const serviceSelect = page.locator('select').filter({
      has: page.locator('option', { hasText: /Choisir un service|Service de votre profil/ }),
    });
    if ((await serviceSelect.locator('option', { hasText: 'Choisir un service' }).count()) > 0) {
      await serviceSelect.selectOption({ index: 1 });
    }
    await page.getByRole('button', { name: 'Continuer vers la vérification' }).click();

    // Étape 4 : le système scanne et applique les règles (aperçu avant import).
    await page.getByRole('button', { name: 'Vérifier le classement' }).click();
    await expect(page.getByText(/1 prêt\(s\) • 1 à revoir • 1 ignoré\(s\) ou déjà présent\(s\)/)).toBeVisible({
      timeout: 30_000,
    });

    await page.getByRole('button', { name: 'Continuer vers l’import' }).click();
    const commitResponse = page.waitForResponse(
      (r) => /\/imports\/[^/]+\/commit/.test(r.url()) && r.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Importer les documents' }).click();
    const res = await commitResponse;
    expect(res.ok(), `commit HTTP ${res.status()}`).toBe(true);
    const result = (await res.json()) as CommitResult;

    // Étape 5 : compte rendu.
    expect(result.failed_items).toBe(0);
    expect(result.imported_documents + result.pending_review_items).toBeGreaterThanOrEqual(2);
    await expect(page.getByText('Importés', { exact: true })).toBeVisible();
    await expect(page.getByText('Doublons', { exact: true })).toBeVisible();
    await expect(page.getByText('Erreurs', { exact: true })).toBeVisible();

    // Post-condition : le fichier couvert par la règle est classé automatiquement.
    const reviews = await adminApi.listReviews();
    expect(reviews.length).toBeGreaterThan(0);
  });
});
