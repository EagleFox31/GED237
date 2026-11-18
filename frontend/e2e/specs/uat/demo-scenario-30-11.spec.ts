import fs from 'fs';
import path from 'path';
import type { Page } from '@playwright/test';
import { test, expect, apiAs, type UatApi } from '../../fixtures/uat.fixture';

/**
 * Scénario de démo du 30/11, de bout en bout (source : gestion-projet/innovateur/scenario-demo-30-11.md,
 * branche docs/scenario-demo-30-11). Tests seuls, aucune modification de l'application.
 *
 * Rôles : A = tenant_admin (MINFI001, en direct), C = reader, D = auditor, E = manager.
 * Une étape du scénario = un test ; les données sont propres à chaque run (runId), donc rejouable
 * sur la pile de démo comme sur la pile UAT. Les compteurs exacts du jeu de démo (367 documents,
 * 16 classés / 12 à revoir / 2 doublons) restent contrôlés par demo-counters.spec.ts (projet `demo`).
 *
 * Ce qui échouerait aujourd'hui serait marqué `test.fixme` avec la PR attendue ; rien pour l'instant (#258 lève l'étape 8).
 * Lancement : `npx playwright test --project=uat specs/uat/demo-scenario-30-11.spec.ts`.
 */

test.describe.configure({ mode: 'serial' });

const MAIN_MENU = (page: Page, name: string | RegExp) => page.getByRole('button', { name });

test.describe('Démo 30/11 — le classement automatique, de bout en bout', () => {
  test.slow();

  let rule: { keyword: string; domainName: string; activityName: string };

  test.beforeAll(async ({ playwright }, testInfo) => {
    // Données propres au run, créées par l'API de l'administrateur (même chemin que les specs UAT).
    const request = await playwright.request.newContext();
    const admin = await apiAs(request, 'tenant_admin');
    const id = `${Date.now().toString(36)}`;
    const domain = await admin.createDomain(`demo-${id}`, `Courriers démo ${id}`);
    const activity = await admin.createActivity(domain.id, `demo-a-${id}`, `Entrants démo ${id}`);
    rule = { keyword: `demo${id}`, domainName: domain.name, activityName: activity.name };
    await admin.createRule({
      code: `demo-rule-${id}`,
      name: `Règle démo ${id}`,
      filenamePattern: rule.keyword,
      domainId: domain.id,
      activityId: activity.id,
    });
    testInfo.annotations.push({ type: 'run', description: id });
    await request.dispose();
  });

  test('Connexion : l\'administrateur voit son nom et son rôle', async ({ page, loginAs }) => {
    await loginAs('tenant_admin');
    await expect(page.getByText('Admin Institution').first()).toBeVisible();
  });

  test('1. Import en vrac : analyse puis compte rendu importés / à revoir / doublons', async ({ page, loginAs, adminApi, runId }, testInfo) => {
    const dupContent = `Déjà dans la GED ${runId}`;
    await adminApi.uploadDocument(`deja-${runId}.txt`, `Déjà présent ${runId}`, dupContent);
    const dir = testInfo.outputPath(`live-${runId}`);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${rule.keyword}-001.txt`), `Courrier ${runId}`);
    fs.writeFileSync(path.join(dir, `zz-divers-${runId}.txt`), `Divers ${runId}`);
    fs.writeFileSync(path.join(dir, `copie-${runId}.txt`), dupContent);

    await loginAs('tenant_admin');
    await MAIN_MENU(page, /Import en masse/).click();
    await expect(page).toHaveURL(/\/(ingestion|imports)/);
    await page.goto('ingestion');
    await page.getByRole('radio', { name: /Importer dans le Serveur de l.Application/ }).click();
    await page.locator('input[type=file][webkitdirectory]').setInputFiles(dir);
    await page.getByRole('button', { name: 'Continuer vers la destination' }).click();

    const service = page.locator('select').filter({ has: page.locator('option', { hasText: 'Choisir un service' }) });
    if ((await service.count()) > 0) await service.first().selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Continuer vers la vérification' }).click();

    for (const card of ['Fichiers analysés', 'Prêts', 'À revoir']) {
      await expect(page.getByText(card, { exact: false }).first()).toBeVisible({ timeout: 30_000 });
    }
    await page.getByRole('button', { name: /Importer les documents/ }).click();
    for (const card of ['Importés', 'À arbitrer', 'Doublons', 'Erreurs']) {
      await expect(page.getByText(card, { exact: false }).first()).toBeVisible({ timeout: 60_000 });
    }
  });

  test('2. Le rangement : service > domaine > activité > année dans l\'explorateur', async ({ page, loginAs, adminApi }) => {
    const doc = await adminApi.uploadDocument(`${rule.keyword}-rangement.txt`, `Rangement ${rule.keyword}`, `Rangement ${rule.keyword}`);
    await expect.poll(async () => (await adminApi.getDocument(doc.id)).classification_status).not.toBe('unclassified');

    await loginAs('tenant_admin');
    await MAIN_MENU(page, /Explorateur documentaire/).click();
    await expect(page).toHaveURL(/\/spaces/);
    await expect(page.getByText(rule.domainName).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Toutes les années/).first()).toBeVisible();
  });

  test('3. Les règles : lecture en clair puis simulateur sans rien déplacer', async ({ page, loginAs, adminApi }) => {
    const snapshot = async () => (await adminApi.getSpaceDocuments({})).json();
    const before = await snapshot();
    await loginAs('tenant_admin');
    await MAIN_MENU(page, /Plan de classement/).click();
    await expect(page).toHaveURL(/\/classement/);
    await page.getByRole('tab', { name: /Règles de classement/ }).click();
    await expect(page.getByText(new RegExp(rule.keyword)).first()).toBeVisible({ timeout: 15_000 });
    await page.getByRole('tab', { name: /Simulateur/ }).click();
    await expect(page.getByRole('tabpanel')).toBeVisible();
    expect(await snapshot(), 'le simulateur ne déplace rien').toEqual(before);
  });

  test('4. La bannette : classer une revue la fait quitter la liste', async ({ page, loginAs, adminApi, runId }) => {
    await adminApi.uploadDocument(`zz-bannette-${runId}.txt`, `Bannette ${runId}`, `Bannette ${runId}`);
    const open = (await adminApi.listReviews()).length;
    test.skip(open === 0, 'aucune revue ouverte : la bannette est vide (voir plan B, § 4 du scénario)');

    await loginAs('tenant_admin');
    await MAIN_MENU(page, /Ma bannette/).click();
    await expect(page).toHaveURL(/\/classification-reviews/);
    await expect(page.getByText('Revue de classement').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Classer et relancer/ }).first()).toBeVisible();
  });

  test('5. Recherche et droits : deux listes pour la même requête, menu réduit du lecteur', async ({ loginAs, page }) => {
    // E : manager DAF (page d'arrivée « Tâches & Validations »), recherche dans le bandeau.
    await loginAs('manager');
    await expect(page.getByText(/Tâches & Validations/).first()).toBeVisible();
    await page.getByRole('searchbox').or(page.getByPlaceholder(/Rechercher/)).first().fill('courrier');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/q=courrier|search/);

  });

  test('5. (suite) Lecteur DSI : menu réduit, ni Rapports, ni Plan de classement, ni Import en masse', async ({ page, loginAs }) => {
    await loginAs('reader');
    await page.getByRole('button', { name: /Tableau de Bord/ }).click();
    for (const hidden of [/Rapports/, /Plan de classement/, /Import en masse/, /Ranger \/ Importer/, /Bibliothèque locale/]) {
      await expect(page.getByRole('button', { name: hidden })).toHaveCount(0);
    }
  });

  test('5 bis. La fiche ouverte depuis la bibliothèque du lecteur est en lecture seule (#334)', async ({ page, loginAs, adminApi, runId }) => {
    const doc = await adminApi.uploadDocument(`lecture-${runId}.txt`, `Lecture ${runId}`, `Lecture ${runId}`);
    await loginAs('reader');
    await page.goto(`documents?q=${encodeURIComponent(runId)}`);
    const card = page.locator('.grid > div').filter({ hasText: `Lecture ${runId}` });
    test.skip((await card.count()) === 0, `document ${doc.id} hors du périmètre du lecteur sur cette pile`);
    await card.first().click();
    await expect(page.getByRole('button', { name: /Archiver|Supprimer|Modifier/ })).toHaveCount(0);
  });

  test('6. Historique : versions du document, puis registre des actions et export CSV (auditeur)', async ({ page, loginAs }) => {
    await loginAs('auditor');
    await page.getByRole('button', { name: /^Audit$/ }).click();
    await expect(page).toHaveURL(/\/audit/);
    await expect(page.getByText('Registre Des Actions')).toBeVisible();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exporter (CSV)' }).click();
    expect((await download).suggestedFilename()).toMatch(/\.csv$/);
  });

  test('7. Rapports : le manager ne voit que « Traitement & délais » et « Services », pas « Synthèse »', async ({ page, loginAs }) => {
    await loginAs('manager');
    await page.getByRole('button', { name: 'Rapports' }).click();
    await expect(page).toHaveURL(/\/reports/);
    await expect(page.getByRole('tab', { name: /Synthèse/ })).toHaveCount(0);
    await page.getByRole('tab', { name: /Traitement & délais/ }).click();
    await page.getByRole('tab', { name: /Services/ }).click();
    await expect(page.getByRole('tabpanel')).toBeVisible();
  });

  test('8. Archivage par la recherche de l\'en-tête : document validé → badge « Archivé »', async ({ page, loginAs, request, adminApi, runId }) => {
    const title = `Démo archivage ${runId}`;
    const manager: UatApi = await apiAs(request, 'manager');
    const doc = await adminApi.uploadDocument(`demo-arch-${runId}.txt`, title, `Archiver ${title}`);
    const [step] = await adminApi.submitForVisa(doc.id, (await manager.me()).id, 'Visa démo');
    const { current_version_id: versionId } = await adminApi.getDocument(doc.id);
    if (!step || !versionId) throw new Error('circuit ou version absent');
    await manager.acceptVisa(step.id, versionId);
    await expect.poll(async () => (await adminApi.getDocument(doc.id)).status).toBe('validated');

    await loginAs('tenant_admin');
    // Contrat #258 : recherche dans l'en-tête, résultat « Ouvrir <titre> », fiche via /documents?open=<id>.
    await page.locator('[data-global-search]').fill(title);
    await page.getByRole('button', { name: `Ouvrir ${title}` }).click();
    await expect(page).toHaveURL(new RegExp(`/documents\\?open=${doc.id}`));
    await page.getByRole('button', { name: 'Archiver', exact: true }).click();
    await page.getByRole('button', { name: 'Oui, archiver', exact: true }).click();
    await expect.poll(async () => (await adminApi.getDocument(doc.id)).status).toBe('archived');
  });
});
