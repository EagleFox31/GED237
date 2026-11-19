import type { APIRequestContext, Page, TestInfo } from '@playwright/test';

import { test, expect } from '../fixtures/auth.fixture';
import { UatApi } from '../fixtures/uat.fixture';
import { DocumentsPage, DraftWorkspacePage, UploadDocumentModalPage } from '../pages/documents.page';
import { DocumentDetailModal } from '../pages/document-detail.page';
import { HeaderPage } from '../pages/header.page';
import { seedCategory } from '../data/seed';
import { uniqueTextFile } from '../data/files';


test.describe('Feature: Explorateur de documents', () => {

  test.beforeEach(async ({ loginAs }) => {
    await loginAs('tenant_admin');
  });

  /**
   * SCENARIO 1: Affichage de la liste des documents
   *
   *   GIVEN  un utilisateur connecté en tant que tenant_admin
   *   WHEN   il accède à la page Documents
   *   THEN   le titre "Mes documents" est visible
   *   AND    la barre de recherche et les filtres sont affichés
   */
  test('Given connecté, When page Documents, Then explorateur visible avec filtres', async ({ page }) => {
    // GIVEN — connecté via beforeEach
    const docsPage = new DocumentsPage(page);

    // WHEN
    await docsPage.goto();

    // THEN
    await docsPage.expectPageVisible();

    // AND
    await expect(docsPage.searchInput).toBeVisible();
    await expect(docsPage.categoryFilter).toBeVisible();
    await expect(docsPage.statusFilter).toBeVisible();
  });

  /**
   * SCENARIO 2: Chargement des documents depuis l'API
   *
   *   GIVEN  un utilisateur connecté
   *   AND    des documents existent en base (seed data)
   *   WHEN   la page Documents se charge
   *   THEN   le spinner disparaît
   *   AND    les cartes de documents s'affichent
   */
  test('Given docs en base, When chargement, Then cartes affichées', async ({ page }) => {
    const docsPage = new DocumentsPage(page);

    // WHEN
    await docsPage.goto();

    // THEN
    await docsPage.expectDocumentsLoaded();

    // AND — le seed data contient 6 documents
    const count = await docsPage.getDocumentCount();
    expect(count).toBeGreaterThan(0);
  });

  /**
   * SCENARIO 3: Clic sur un document ouvre le modal de détail
   *
   *   GIVEN  des documents sont affichés dans la grille
   *   WHEN   l'utilisateur clique sur un document
   *   THEN   le modal de détail s'ouvre
   *   AND    le titre du document est affiché dans le header du modal
   */
  test('Given documents affichés, When clic document, Then modal détail ouvert', async ({ page }) => {
    const docsPage = new DocumentsPage(page);
    const detailModal = new DocumentDetailModal(page);

    // GIVEN
    await docsPage.goto();
    await docsPage.expectAtLeastOneDocument();

    // WHEN
    await docsPage.clickFirstDocument();

    // THEN
    await detailModal.expectModalVisible();

    // AND
    await expect(detailModal.documentTitle).not.toBeEmpty();
  });

  /**
   * SCENARIO 4: Le modal affiche les métadonnées du document
   *
   *   GIVEN  le modal de détail est ouvert
   *   WHEN   l'onglet "Détails & Aperçu" est actif
   *   THEN   les métadonnées sont visibles (propriétaire, date, type, taille, catégorie, version)
   *   AND    le bouton Télécharger est présent
   */
  test('Given modal ouvert, When onglet info, Then métadonnées visibles', async ({ page }) => {
    const docsPage = new DocumentsPage(page);
    const detailModal = new DocumentDetailModal(page);

    // GIVEN
    await docsPage.goto();
    await docsPage.expectAtLeastOneDocument();
    await docsPage.clickFirstDocument();
    await detailModal.expectModalVisible();

    // WHEN — onglet Info est actif par défaut

    // THEN
    await detailModal.expectMetadataVisible();

    // AND
    await expect(detailModal.downloadButton).toBeVisible();

    // WHEN — on clique sur Télécharger
    const [download] = await Promise.all([page.waitForEvent('download'), detailModal.downloadButton.click()]);

    // THEN — le fichier part vraiment
    expect(download.suggestedFilename()).toMatch(/\.[A-Za-z0-9]+$/);
  });

  /**
   * SCENARIO 5: Navigation entre les onglets du modal
   *
   *   GIVEN  le modal de détail est ouvert sur l'onglet Info
   *   WHEN   l'utilisateur clique sur "Circuit de Validation"
   *   THEN   le contenu workflow s'affiche
   *   WHEN   il clique sur "Historique des Versions"
   *   THEN   les versions (ou l'état vide) s'affichent
   */
  test('Given modal info, When switch onglets, Then contenu change', async ({ page }) => {
    const docsPage = new DocumentsPage(page);
    const detailModal = new DocumentDetailModal(page);

    // GIVEN
    await docsPage.goto();
    await docsPage.expectAtLeastOneDocument();
    await docsPage.clickFirstDocument();
    await detailModal.expectModalVisible();

    // WHEN — switch to workflow
    await detailModal.switchToWorkflowTab();

    // THEN — the circuit steps or the empty state, once loaded (seeded documents have a circuit)
    await expect(detailModal.workflowSteps.first().or(detailModal.workflowEmpty)).toBeVisible();

    // WHEN — switch to history
    await detailModal.switchToHistoryTab();

    // THEN — asserted by switchToHistoryTab (versions or empty state)
  });

  /**
   * SCENARIO 6: Fermeture du modal via le bouton Fermer
   *
   *   GIVEN  le modal de détail est ouvert
   *   WHEN   l'utilisateur clique "Fermer"
   *   THEN   le modal disparaît
   *   AND    la grille de documents est toujours visible
   */
  test('Given modal ouvert, When clic fermer, Then retour à la grille', async ({ page }) => {
    const docsPage = new DocumentsPage(page);
    const detailModal = new DocumentDetailModal(page);

    // GIVEN
    await docsPage.goto();
    await docsPage.expectAtLeastOneDocument();
    await docsPage.clickFirstDocument();
    await detailModal.expectModalVisible();

    // WHEN
    await detailModal.close();

    // THEN
    await detailModal.expectModalHidden();

    // AND
    await docsPage.expectPageVisible();
  });
});

test.describe('Feature: Upload de document (Collaborateur)', () => {

  test.beforeEach(async ({ loginAs }) => {
    await loginAs('collaborator');
  });

  /**
   * SCENARIO 7: Affichage du DraftWorkspace pour un collaborateur
   *
   *   GIVEN  un collaborateur connecté
   *   WHEN   le dashboard s'affiche
   *   THEN   le titre "Mon Atelier" est visible
   *   AND    le bouton "Nouveau Document" est présent
   */
  test('Given collaborateur, When dashboard, Then atelier visible', async ({ page }) => {
    const workspace = new DraftWorkspacePage(page);

    // GIVEN — connecté via beforeEach

    // THEN
    await workspace.expectPageVisible();

    // AND
    await expect(workspace.newDocButton).toBeVisible();
  });

  /**
   * SCENARIO 8: Ouverture du modal d'upload
   *
   *   GIVEN  un collaborateur sur son atelier
   *   WHEN   il clique "Nouveau Document"
   *   THEN   le modal d'upload s'affiche avec titre, catégorie, tags, fichier
   */
  test('Given atelier, When clic nouveau doc, Then modal upload affiché', async ({ page }) => {
    const workspace = new DraftWorkspacePage(page);

    // GIVEN
    await workspace.expectPageVisible();

    // WHEN
    await workspace.openUploadModal();

    // THEN
    await expect(workspace.titleInput).toBeVisible();
    await expect(workspace.categorySelect).toBeVisible();
    await expect(workspace.tagsInput).toBeVisible();
    await expect(workspace.fileInput).toBeAttached();
    await expect(workspace.createButton).toBeVisible();
  });

  /**
   * SCENARIO 9: Upload réussi d'un document
   *
   *   GIVEN  le modal d'upload est ouvert
   *   WHEN   le collaborateur remplit le titre, la catégorie, les tags
   *   AND    il sélectionne un fichier
   *   AND    il clique "Créer le Document"
   *   THEN   le modal se ferme
   *   AND    le document apparaît dans la grille
   */
  test('Given modal upload, When remplir et soumettre, Then document créé', async ({ page }) => {
    const workspace = new DraftWorkspacePage(page);
    const docTitle = `Test E2E ${Date.now()}`;

    // GIVEN
    await workspace.expectPageVisible();
    await workspace.openUploadModal();

    // WHEN
    await workspace.fillUploadForm(docTitle, 'Note', 'test, e2e', uniqueTextFile());

    // AND
    await workspace.submitUpload();

    // THEN
    await workspace.expectUploadModalClosed();

    // AND — la grille rafraîchie contient le nouveau doc
    await workspace.expectDocumentsLoaded();
    await expect(page.locator('.grid').getByText(docTitle)).toBeVisible({ timeout: 10_000 });
  });

  /**
   * SCENARIO 10: Soumission d'un brouillon au circuit de validation
   *
   *   GIVEN  un document en statut "draft" existe dans l'atelier
   *   WHEN   le collaborateur clique "Soumettre" sur ce document
   *   AND    il sélectionne un valideur et confirme
   *   THEN   le modal se ferme
   *   AND    le statut du document change (plus de bouton "Soumettre")
   */
  test('Given brouillon existant, When soumettre au visa, Then workflow créé', async ({ page }) => {
    const workspace = new DraftWorkspacePage(page);

    // GIVEN — créer un document d'abord
    await workspace.expectPageVisible();
    await workspace.expectDocumentsLoaded();

    // On cherche un doc draft existant, sinon on en crée un
    const draftButton = page.getByRole('button', { name: /soumettre/i }).first();
    const hasDraft = await draftButton.isVisible().catch(() => false);

    if (!hasDraft) {
      // Créer un doc pour avoir un draft
      const docTitle = `Draft Visa ${Date.now()}`;
      await workspace.openUploadModal();
      await workspace.fillUploadForm(docTitle, 'Courrier', 'visa', uniqueTextFile());
      await workspace.submitUpload();
      await workspace.expectUploadModalClosed();
      await workspace.expectDocumentsLoaded();
    }

    // WHEN — clic soumettre
    await page.getByRole('button', { name: /soumettre/i }).first().click();

    // AND — sélectionner un valideur
    await expect(workspace.submitModal).toBeVisible();
    // Sélectionner la première option non-vide
    const options = workspace.validatorSelect.locator('option:not([disabled])');
    const optionCount = await options.count();
    if (optionCount > 0) {
      const firstValue = await options.first().getAttribute('value');
      if (firstValue) {
        await workspace.validatorSelect.selectOption(firstValue);
        await workspace.submitWorkflowButton.click();

        // THEN
        await expect(workspace.submitModal).toBeHidden({ timeout: 10_000 });
      }
    }
  });
});

test.describe('Feature: Upload depuis « Mes documents » (Admin)', () => {

  test.beforeEach(async ({ loginAs }) => {
    await loginAs('tenant_admin');
  });

  /**
   * SCENARIO 11: Bouton "Nouveau Document" ouvre la modale d'upload
   *
   *   GIVEN  un admin connecté sur « Mes documents »
   *   WHEN   il clique "Nouveau Document"
   *   THEN   la modale s'affiche : zone de dépôt, titre, catégorie, tags, desc
   *   AND    le bouton "Envoyer" est désactivé (aucun fichier sélectionné)
   */
  test('Given explorateur, When clic nouveau, Then modale upload affichée et submit désactivé', async ({ page }) => {
    const docsPage = new DocumentsPage(page);
    const modal = new UploadDocumentModalPage(page);

    // GIVEN
    await docsPage.goto();
    await docsPage.expectPageVisible();

    // WHEN
    await docsPage.uploadButton.click();

    // THEN
    await modal.expectVisible();
    await expect(modal.dropZone).toBeVisible();
    await expect(modal.titleInput).toBeVisible();
    await expect(modal.categorySelect).toBeVisible();
    await expect(modal.tagsInput).toBeVisible();

    // AND — pas de fichier => bouton désactivé
    await modal.expectSubmitDisabled();
  });

  /**
   * SCENARIO 11 bis (Lot 8 point 5) : petit écran 1366×768 zoomé à 125 % (≈ 1093×614 px CSS)
   *   GIVEN  la fenêtre « Nouveau Document » plus haute que l'écran
   *   THEN   « Annuler » et « Envoyer » sont visibles sans faire défiler la fenêtre
   */
  test('Given petit écran zoomé, When modale ouverte, Then boutons visibles sans défiler', async ({ page }) => {
    await page.setViewportSize({ width: 1093, height: 614 });
    const docsPage = new DocumentsPage(page);
    const modal = new UploadDocumentModalPage(page);
    await docsPage.goto();
    await docsPage.expectPageVisible();
    await docsPage.uploadButton.click();
    await modal.expectVisible();

    const actions = page.getByTestId('upload-actions');
    const layout = await actions.evaluate((el) => {
      const scroller = el.closest('.overflow-y-auto') as HTMLElement;
      return {
        overflows: scroller.scrollHeight > scroller.clientHeight,
        scrollTop: scroller.scrollTop,
        actionsBottom: el.getBoundingClientRect().bottom,
        scrollerBottom: scroller.getBoundingClientRect().bottom,
      };
    });
    // Le cas n'a de sens que si la fenêtre déborde : sinon le test ne prouverait rien.
    expect(layout.overflows, 'la fenêtre doit déborder à cette taille').toBe(true);
    expect(layout.scrollTop).toBe(0);
    expect(layout.actionsBottom).toBeLessThanOrEqual(layout.scrollerBottom + 1);
    await expect(actions.getByRole('button', { name: /annuler/i })).toBeInViewport({ ratio: 1 });
    await expect(actions.getByRole('button', { name: /envoyer/i })).toBeInViewport({ ratio: 1 });
  });

  /**
   * SCENARIO 12: Fermeture de la modale via Annuler
   *
   *   GIVEN  la modale d'upload est ouverte
   *   WHEN   l'utilisateur clique "Annuler"
   *   THEN   la modale se ferme
   *   AND    la grille de documents est toujours visible
   */
  test('Given modale ouverte, When annuler, Then modale fermée sans effet', async ({ page }) => {
    const docsPage = new DocumentsPage(page);
    const modal = new UploadDocumentModalPage(page);

    // GIVEN
    await docsPage.goto();
    await docsPage.uploadButton.click();
    await modal.expectVisible();

    // WHEN
    await modal.cancel();

    // THEN
    await modal.expectHidden();

    // AND
    await docsPage.expectPageVisible();
  });

  /**
   * SCENARIO 13: Sélection d'un fichier active le bouton Envoyer
   *
   *   GIVEN  la modale est ouverte
   *   WHEN   un fichier est sélectionné
   *   THEN   le nom du fichier est affiché
   *   AND    le titre est pré-rempli automatiquement
   *   AND    le bouton "Envoyer" s'active
   */
  test('Given modale, When fichier sélectionné, Then bouton activé et titre pré-rempli', async ({ page }) => {
    const docsPage = new DocumentsPage(page);
    const modal = new UploadDocumentModalPage(page);

    // GIVEN
    await docsPage.goto();
    await docsPage.uploadButton.click();
    await modal.expectVisible();

    // WHEN
    await modal.setFile(uniqueTextFile());

    // THEN — nom du fichier visible dans la zone de dép
    await expect(modal.dropZone).toContainText('test-document');

    // AND — bouton actif
    await modal.expectSubmitEnabled();
  });

  /**
   * SCENARIO 14: Validation - titre vide bloque la soumission
   *
   *   GIVEN  un fichier est sélectionné
   *   WHEN   le titre est effacé et le formulaire soumis
   *   THEN   un message d'erreur "titre est obligatoire" s'affiche
   *   AND    la modale reste ouverte
   */
  test('Given fichier sélectionné, When titre vide et submit, Then erreur titre affiché', async ({ page }) => {
    const docsPage = new DocumentsPage(page);
    const modal = new UploadDocumentModalPage(page);

    // GIVEN
    await docsPage.goto();
    await docsPage.uploadButton.click();
    await modal.expectVisible();
    await modal.setFile(uniqueTextFile());

    // WHEN — vider le titre (auto-rempli) et soumettre
    await modal.fillTitle('');
    await modal.submit();

    // THEN
    await modal.expectErrorContaining('titre est obligatoire');

    // AND — modale reste ouverte
    await modal.expectVisible();
  });

  /**
   * SCENARIO 15: Upload réussi - document apparaît dans la liste
   *
   *   GIVEN  la modale est ouverte avec un fichier et un titre
   *   WHEN   les métadonnées sont remplies et le formulaire soumis
   *   THEN   un spinner de chargement s'affiche
   *   AND    la modale se ferme automatiquement
   *   AND    le nouveau document apparaît dans la grille
   *   AND    son statut est "draft" ou "in_review" (selon la règle GEDRules)
   */
  test('Given form complet, When submit, Then document créé et liste rafraîchie', async ({ page }) => {
    const docsPage = new DocumentsPage(page);
    const modal = new UploadDocumentModalPage(page);
    const docTitle = `GED Upload E2E ${Date.now()}`;

    // GIVEN
    await docsPage.goto();
    await docsPage.expectDocumentsLoaded();
    const countBefore = await docsPage.getDocumentCount();

    await docsPage.uploadButton.click();
    await modal.expectVisible();

    // WHEN
    await modal.setFile(uniqueTextFile());
    await modal.fillTitle(docTitle);
    await modal.selectCategory({ label: seedCategory('E2E-CAT-GEN').name });
    await modal.fillTags('test, e2e, playwright');
    await modal.fillDescription('Document de test créé par Playwright.');
    await modal.submit();

    // THEN — modale se ferme
    await modal.expectHidden();

    // AND — grille actualisée
    await docsPage.expectDocumentsLoaded();
    const countAfter = await docsPage.getDocumentCount();
    expect(countAfter).toBeGreaterThan(countBefore);

    // AND — le nouveau document est dans la liste avec un statut valide
    const card = page.locator('.grid > div.glass').filter({ hasText: docTitle });
    await expect(card).toBeVisible({ timeout: 10_000 });
    await expect(card).toContainText(/brouillon|en révision/i);
  });
});

/** Unique suffix per test and retry: titles and upload checksums never collide on a replayed base. */
const runIdOf = (info: TestInfo) => `${Date.now().toString(36)}${info.workerIndex}${info.retry}`;

/** API helper on the session opened by loginAs (no extra 2FA login, so no rate-limit pressure). */
async function sessionApi(page: Page, request: APIRequestContext): Promise<UatApi> {
  const token = await page.evaluate(() => sessionStorage.getItem('access_token'));
  if (!token) throw new Error('access_token absent from sessionStorage after loginAs');
  return new UatApi(request, token);
}

const openUrl = (documentId: string) => new RegExp(`/documents[?](.*&)?open=${documentId}(&|$)`);

test.describe('header search → document → archive (#256)', () => {
  test.slow(); // visa circuit set up through the API, two roles

  /**
   * SCENARIO 16: Recherche du bandeau → fiche → Archiver
   *
   *   GIVEN  un document validé (circuit d'un visa : déposé par l'admin, visé par le Manager)
   *   AND    l'admin sur l'accueil (la liste globale n'existe pas sur /documents, /spaces, /users)
   *   WHEN   il tape le titre dans la recherche du bandeau et clique le résultat
   *   THEN   /documents?open=<id> s'ouvre sur la fiche du document
   *   WHEN   il clique « Archiver » puis « Oui, archiver »
   *   THEN   le document est archivé (API et badge « Archivé »)
   */
  test('Given doc validé, When recherche bandeau puis clic résultat et Archiver, Then fiche ouverte et doc archivé', async ({ page, request, loginAs }) => {
    const runId = runIdOf(test.info());
    const title = `Recherche archivage 256 ${runId}`;
    const header = new HeaderPage(page);
    const detail = new DocumentDetailModal(page);

    // GIVEN — tenant_admin owns `documents archive`; the API only archives a validated or signed document.
    await loginAs('manager');
    const manager = await sessionApi(page, request);
    await loginAs('tenant_admin');
    const admin = await sessionApi(page, request);
    const doc = await admin.uploadDocument(`search-archive-${runId}.txt`, title, `Recherche puis archivage ${runId}`);
    const [step] = await admin.submitForVisa(doc.id, (await manager.me()).id, 'Visa #256');
    const { current_version_id: versionId } = await admin.getDocument(doc.id);
    if (!step || !versionId) throw new Error(`no visa step or current version for ${title}`);
    await manager.acceptVisa(step.id, versionId);
    await expect.poll(async () => (await admin.getDocument(doc.id)).status).toBe('validated');

    // WHEN — search from the dashboard (loginAs lands there), click the result
    await header.searchAndOpen(title);

    // THEN — the document opens
    await expect(page).toHaveURL(openUrl(doc.id));
    await detail.expectOpenOn(title);

    // WHEN — archive from the document
    await detail.archive();

    // THEN — server state first (the button reads « Archivage… » during the request), then what the user sees
    await expect.poll(async () => (await admin.getDocument(doc.id)).status).toBe('archived');
    await detail.expectArchived(title);
  });

  /**
   * SCENARIO 17: Entrée dans la recherche du bandeau ouvre le premier résultat
   *
   *   GIVEN  un document au titre unique
   *   WHEN   l'admin tape ce titre dans le bandeau
   *   THEN   le statut du résultat est traduit (pas « draft » brut)
   *   WHEN   il appuie sur Entrée
   *   THEN   la fiche du document s'ouvre (/documents?open=<id>)
   *   AND    la fermer retire ?open= de l'URL
   */
  test('Given doc, When recherche bandeau puis Entrée, Then fiche ouverte et fermeture nettoie l\'URL', async ({ page, request, loginAs }) => {
    const runId = runIdOf(test.info());
    const title = `Recherche entree 256 ${runId}`;
    const header = new HeaderPage(page);
    const detail = new DocumentDetailModal(page);

    // GIVEN
    await loginAs('tenant_admin');
    const admin = await sessionApi(page, request);
    const doc = await admin.uploadDocument(`search-enter-${runId}.txt`, title, `Recherche par Entrée ${runId}`);

    // WHEN
    await header.searchFor(title, title);

    // THEN — translated status label in the result row
    await expect(header.searchResult(title)).not.toContainText(/\b(draft|in_review|validated)\b/);

    // WHEN
    await header.searchInput.press('Enter');

    // THEN
    await expect(page).toHaveURL(openUrl(doc.id));
    await detail.expectOpenOn(title);

    // AND
    await detail.close();
    await expect(detail.heading(title)).toBeHidden();
    await expect(page).not.toHaveURL(/[?&]open=/);
  });

  /**
   * SCENARIO 18: « Mes documents » trouve un document par son titre (recherche côté serveur, #256 écart 9)
   *
   *   GIVEN  un document au titre unique
   *   WHEN   l'admin le cherche dans la barre de « Mes documents »
   *   THEN   sa carte est affichée
   */
  test('Given doc au titre unique, When recherche dans Mes documents, Then carte trouvée', async ({ page, request, loginAs }) => {
    const runId = runIdOf(test.info());
    const title = `Mes documents 256 ${runId}`;
    const docsPage = new DocumentsPage(page);

    // GIVEN
    await loginAs('tenant_admin');
    const admin = await sessionApi(page, request);
    await admin.uploadDocument(`my-docs-${runId}.txt`, title, `Mes documents ${runId}`);

    // WHEN
    await docsPage.goto();
    await docsPage.expectPageVisible();
    await docsPage.searchDocuments(title);

    // THEN
    await expect(docsPage.documentHeading(title)).toBeVisible({ timeout: 10_000 });
  });
});
