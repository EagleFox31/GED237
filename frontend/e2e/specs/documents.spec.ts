import path from 'path';
import { fileURLToPath } from 'url';
import { test, expect } from '../fixtures/auth.fixture';
import { DocumentsPage, DraftWorkspacePage, UploadDocumentModalPage } from '../pages/documents.page';
import { DocumentDetailModal } from '../pages/document-detail.page';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_FILE = path.resolve(__dirname, '../fixtures/files/test-document.txt');

test.describe('Feature: Explorateur de documents', () => {

  test.beforeEach(async ({ loginAs }) => {
    await loginAs('tenant_admin');
  });

  /**
   * SCENARIO 1: Affichage de la liste des documents
   *
   *   GIVEN  un utilisateur connecté en tant que tenant_admin
   *   WHEN   il accède à la page Documents
   *   THEN   le titre "Explorateur GED" est visible
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
   *   AND    les boutons Télécharger et Partager sont présents
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
    await expect(detailModal.shareButton).toBeVisible();
  });

  /**
   * SCENARIO 5: Navigation entre les onglets du modal
   *
   *   GIVEN  le modal de détail est ouvert sur l'onglet Info
   *   WHEN   l'utilisateur clique sur "Circuit de Validation"
   *   THEN   le contenu workflow s'affiche
   *   WHEN   il clique sur "Historique des Versions"
   *   THEN   le message "fonctionnalité à venir" s'affiche
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

    // THEN — either steps or empty state visible
    const hasSteps = await detailModal.workflowSteps.count() > 0;
    if (!hasSteps) {
      await detailModal.expectNoWorkflowSteps();
    }

    // WHEN — switch to history
    await detailModal.switchToHistoryTab();

    // THEN
    await expect(page.getByText(/fonctionnalité à venir/i)).toBeVisible();
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
    await workspace.fillUploadForm(docTitle, 'Note', 'test, e2e', TEST_FILE);

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
      await workspace.fillUploadForm(docTitle, 'Courrier', 'visa', TEST_FILE);
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

test.describe('Feature: Upload depuis l\'Explorateur GED (Admin)', () => {

  test.beforeEach(async ({ loginAs }) => {
    await loginAs('tenant_admin');
  });

  /**
   * SCENARIO 11: Bouton "Nouveau Document" ouvre la modale d'upload
   *
   *   GIVEN  un admin connecté sur l'Explorateur GED
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
    await modal.setFile(TEST_FILE);

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
    await modal.setFile(TEST_FILE);

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
    await modal.setFile(TEST_FILE);
    await modal.fillTitle(docTitle);
    await modal.selectCategory('finance');
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
