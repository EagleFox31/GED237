import { test, expect } from '../fixtures/auth.fixture';
import { OrganizationPage } from '../pages/organization.page';

test.describe('Feature: Arbre organisationnel', () => {

  test.beforeEach(async ({ loginAs }) => {
    await loginAs('tenant_admin');
  });

  /**
   * SCENARIO 1: Affichage de la page Organisation
   *
   *   GIVEN  un tenant_admin connecté
   *   WHEN   il accède à /org
   *   THEN   le panneau "Hiérarchie" s'affiche à gauche
   *   AND    l'arbre des org units est chargé depuis l'API
   */
  test('Given tenant_admin, When accès /org, Then arbre hiérarchique affiché', async ({ page }) => {
    const orgPage = new OrganizationPage(page);

    // WHEN
    await orgPage.goto();

    // THEN
    await orgPage.expectPageVisible();

    // AND
    await orgPage.expectAtLeastOneNode();
  });

  /**
   * SCENARIO 2: Sélection d'un noeud affiche les détails
   *
   *   GIVEN  l'arbre est chargé avec des noeuds
   *   WHEN   l'utilisateur clique sur un noeud de l'arbre
   *   THEN   le panneau droit affiche le nom et le code de l'unité
   *   AND    les onglets Info, Règles GED, Personnel, Organigramme, Statistiques sont visibles
   */
  test('Given arbre chargé, When clic noeud, Then détails affichés avec onglets', async ({ page }) => {
    const orgPage = new OrganizationPage(page);

    // GIVEN
    await orgPage.goto();
    await orgPage.expectAtLeastOneNode();

    // WHEN — le premier noeud est sélectionné par défaut
    // THEN
    await expect(orgPage.unitName).toBeVisible();

    // AND
    await expect(orgPage.infoTab).toBeVisible();
    await expect(orgPage.staffTab).toBeVisible();
    await expect(orgPage.chartTab).toBeVisible();
  });

  /**
   * SCENARIO 3: Onglet Info affiche les KPIs et l'identité
   *
   *   GIVEN  une unité est sélectionnée
   *   WHEN   l'onglet "Informations Générales" est actif
   *   THEN   les cartes Documents Actifs, Agents Assignés, Sous-Unités sont affichées
   *   AND    la section "Identité de l'Unité" montre le nom, code, parent
   */
  test('Given unité sélectionnée, When onglet info, Then KPIs et identité visibles', async ({ page }) => {
    const orgPage = new OrganizationPage(page);

    // GIVEN
    await orgPage.goto();
    await orgPage.expectAtLeastOneNode();

    // WHEN — onglet Info actif par défaut
    await orgPage.switchToInfoTab();

    // THEN
    await expect(orgPage.documentsCard).toBeVisible();
    await expect(orgPage.agentsCard).toBeVisible();
    await expect(orgPage.subUnitsCard).toBeVisible();

    // AND
    await expect(orgPage.unitIdentitySection).toBeVisible();
  });

  /**
   * SCENARIO 4: Onglet Personnel affiche le tableau des agents
   *
   *   GIVEN  une unité est sélectionnée
   *   WHEN   l'utilisateur clique sur l'onglet "Personnel"
   *   THEN   le tableau des agents s'affiche avec colonnes Agent, Matricule, Contact, Statut, Actions
   *   AND    le bouton "Créer Utilisateur" est visible
   */
  test('Given unité sélectionnée, When onglet personnel, Then tableau agents visible', async ({ page }) => {
    const orgPage = new OrganizationPage(page);

    // GIVEN
    await orgPage.goto();
    await orgPage.expectAtLeastOneNode();

    // WHEN
    await orgPage.switchToStaffTab();

    // THEN
    await expect(orgPage.staffTable).toBeVisible();
    await expect(page.getByText('Agent')).toBeVisible();
    await expect(page.getByText('Matricule')).toBeVisible();

    // AND
    await expect(orgPage.createUserButton).toBeVisible();
  });

  /**
   * SCENARIO 5: Onglet Organigramme affiche la vue hiérarchique
   *
   *   GIVEN  une unité est sélectionnée
   *   WHEN   l'utilisateur clique sur "Organigramme"
   *   THEN   la vue hiérarchique s'affiche avec le noeud racine et ses enfants
   */
  test('Given unité sélectionnée, When onglet organigramme, Then vue hiérarchique affichée', async ({ page }) => {
    const orgPage = new OrganizationPage(page);

    // GIVEN
    await orgPage.goto();
    await orgPage.expectAtLeastOneNode();

    // WHEN
    await orgPage.switchToChartTab();

    // THEN
    await expect(orgPage.chartView).toBeVisible();
  });
});

test.describe('Feature: Création d\'unité organisationnelle', () => {

  test.beforeEach(async ({ loginAs }) => {
    await loginAs('tenant_admin');
  });

  /**
   * SCENARIO 6: Ouverture du modal de création d'unité
   *
   *   GIVEN  un tenant_admin sur la page Organisation
   *   WHEN   il clique "Nouvelle Structure"
   *   THEN   le modal s'ouvre avec les champs Nom, Code, Parent ID, Description
   */
  test('Given page org, When clic nouvelle structure, Then modal affiché', async ({ page }) => {
    const orgPage = new OrganizationPage(page);

    // GIVEN
    await orgPage.goto();
    await orgPage.expectPageVisible();

    // WHEN
    await orgPage.openCreateOrgModal();

    // THEN
    await expect(orgPage.orgNameInput).toBeVisible();
    await expect(orgPage.orgCodeInput).toBeVisible();
    await expect(orgPage.orgParentInput).toBeVisible();
    await expect(orgPage.orgDescriptionInput).toBeVisible();
    await expect(orgPage.orgSubmitButton).toBeVisible();
  });

  /**
   * SCENARIO 7: Création réussie d'une nouvelle unité
   *
   *   GIVEN  le modal de création est ouvert
   *   WHEN   l'utilisateur remplit nom et code
   *   AND    il soumet le formulaire
   *   THEN   le modal se ferme
   *   AND    la nouvelle unité apparaît dans l'arbre
   */
  test('Given modal ouvert, When remplir et soumettre, Then unité créée dans l\'arbre', async ({ page }) => {
    const orgPage = new OrganizationPage(page);
    const orgName = `Test Unité ${Date.now()}`;
    const orgCode = `TU-${Date.now().toString().slice(-6)}`;

    // GIVEN
    await orgPage.goto();
    await orgPage.expectPageVisible();
    await orgPage.openCreateOrgModal();

    // WHEN
    await orgPage.fillOrgForm(orgName, orgCode, 'Unité créée par test E2E');

    // AND
    await orgPage.submitOrgForm();

    // THEN
    await orgPage.expectOrgModalClosed();

    // AND — l'arbre se rafraîchit et contient la nouvelle unité
    await orgPage.expectTreeLoaded();
    await expect(page.getByText(orgName)).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Feature: Création d\'utilisateur dans une unité', () => {

  test.beforeEach(async ({ loginAs }) => {
    await loginAs('tenant_admin');
  });

  /**
   * SCENARIO 8: Ouverture du modal de création utilisateur
   *
   *   GIVEN  un tenant_admin sur l'onglet Personnel d'une unité
   *   WHEN   il clique "Créer Utilisateur"
   *   THEN   le modal s'ouvre avec les champs Email, Prénom, Nom, Mot de passe, Rôle
   *   AND    le nom de l'unité est indiqué dans le header du modal
   */
  test('Given onglet personnel, When clic créer utilisateur, Then modal affiché', async ({ page }) => {
    const orgPage = new OrganizationPage(page);

    // GIVEN
    await orgPage.goto();
    await orgPage.expectAtLeastOneNode();

    // WHEN
    await orgPage.openCreateUserModal();

    // THEN
    await expect(orgPage.userEmailInput).toBeVisible();
    await expect(orgPage.userFirstNameInput).toBeVisible();
    await expect(orgPage.userLastNameInput).toBeVisible();
    await expect(orgPage.userPasswordInput).toBeVisible();
    await expect(orgPage.userRoleSelect).toBeVisible();

    // AND — le header montre "Pour: <nom unité>"
    await expect(orgPage.userModal.getByText(/Pour:/)).toBeVisible();
  });

  /**
   * SCENARIO 9: Création réussie d'un utilisateur
   *
   *   GIVEN  le modal de création utilisateur est ouvert
   *   WHEN   l'admin remplit email, prénom, nom, mot de passe et rôle
   *   AND    il soumet le formulaire
   *   THEN   le modal se ferme
   *   AND    le nouvel agent apparaît dans le tableau du personnel
   */
  test('Given modal user ouvert, When remplir et soumettre, Then utilisateur créé', async ({ page }) => {
    const orgPage = new OrganizationPage(page);
    const timestamp = Date.now();
    const email = `test.e2e.${timestamp}@min.gov.cm`;
    const firstName = 'Test';
    const lastName = `E2E${timestamp.toString().slice(-4)}`;

    // GIVEN
    await orgPage.goto();
    await orgPage.expectAtLeastOneNode();
    await orgPage.openCreateUserModal();

    // WHEN
    await orgPage.fillUserForm(email, firstName, lastName, 'TestPass@2025', 'collaborator');

    // AND
    await orgPage.submitUserForm();

    // THEN
    await orgPage.expectUserModalClosed();

    // AND — le tableau rafraîchi contient le nouvel agent
    await expect(page.getByText(email)).toBeVisible({ timeout: 10_000 });
  });

  /**
   * SCENARIO 10: Le sélecteur de rôle propose les bons choix
   *
   *   GIVEN  le modal de création utilisateur est ouvert
   *   WHEN   l'admin ouvre le sélecteur de rôle
   *   THEN   les options Collaborateur, Manager, Administrateur d'Unité, Lecteur sont disponibles
   */
  test('Given modal user, When voir rôles, Then 4 options disponibles', async ({ page }) => {
    const orgPage = new OrganizationPage(page);

    // GIVEN
    await orgPage.goto();
    await orgPage.expectAtLeastOneNode();
    await orgPage.openCreateUserModal();

    // WHEN/THEN
    const options = orgPage.userRoleSelect.locator('option');
    await expect(options).toHaveCount(4);
    await expect(options.nth(0)).toHaveText('Collaborateur');
    await expect(options.nth(1)).toContainText('Manager');
    await expect(options.nth(2)).toContainText("Administrateur d'Unité");
    await expect(options.nth(3)).toHaveText('Lecteur Simple');
  });
});
