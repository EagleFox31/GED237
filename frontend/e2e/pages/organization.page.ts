import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page Object Model for OrganizationPage (profiles/tenant-admin/pages/OrganizationPage.tsx).
 * Covers: org tree sidebar, unit detail tabs (info, staff, chart), create unit modal, agent creation via /users.
 */
export class OrganizationPage {
  readonly page: Page;

  // Sidebar — Org tree
  readonly hierarchyTitle: Locator;
  readonly filterInput: Locator;
  readonly refreshButton: Locator;
  readonly treeNodes: Locator;
  readonly newStructureButton: Locator;
  readonly loadingText: Locator;
  readonly emptyTreeText: Locator;

  // Main panel — Unit detail header
  readonly unitName: Locator;
  readonly unitCode: Locator;
  readonly deleteButton: Locator;
  readonly editButton: Locator;
  readonly noSelectionState: Locator;

  // Tabs
  readonly infoTab: Locator;
  readonly rulesTab: Locator;
  readonly staffTab: Locator;
  readonly chartTab: Locator;
  readonly statsTab: Locator;

  // Info tab content
  readonly documentsCard: Locator;
  readonly agentsCard: Locator;
  readonly subUnitsCard: Locator;
  readonly unitIdentitySection: Locator;

  // Staff tab content
  readonly staffTable: Locator;
  readonly staffRows: Locator;
  readonly noAgentText: Locator;
  readonly createUserButton: Locator;

  // Chart tab
  readonly chartView: Locator;

  // Create Org modal
  readonly orgModal: Locator;
  readonly orgNameInput: Locator;
  readonly orgCodeInput: Locator;
  readonly orgSubmitButton: Locator;

  // Création d'agent : « Créer un agent » ouvre le formulaire de /users (AgentsListTab).
  readonly userModal: Locator;
  readonly userMatriculeInput: Locator;
  readonly userEmailInput: Locator;
  readonly userFirstNameInput: Locator;
  readonly userLastNameInput: Locator;
  readonly userRoleSelect: Locator;
  readonly userSubmitButton: Locator;
  readonly tempPasswordDialog: Locator;

  constructor(page: Page) {
    // Sidebar
    this.hierarchyTitle = page.getByText('Hiérarchie');
    this.filterInput = page.getByPlaceholder('Filtrer la structure...');
    this.refreshButton = page.locator('button:has(span:text("refresh"))');
    this.treeNodes = page.locator('.custom-scrollbar .select-none div.cursor-pointer, .custom-scrollbar .select-none [class*="cursor-pointer"]').filter({ hasText: /\S/ });
    this.newStructureButton = page.getByRole('button', { name: /nouveau service racine/i });
    this.loadingText = page.getByText('Chargement...');
    this.emptyTreeText = page.getByText("Aucune structure d'organisation définie.");

    // Unit detail header
    this.unitName = page.locator('h1.text-3xl');
    this.unitCode = page.locator('text=Code:').locator('..');
    this.deleteButton = page.getByRole('button', { name: /supprimer/i });
    this.editButton = page.getByRole('button', { name: /modifier/i });
    this.noSelectionState = page.getByText('Sélectionnez ou créez une structure');

    // Tabs
    this.infoTab = page.getByRole('button', { name: /informations générales/i });
    this.rulesTab = page.getByRole('button', { name: /règles ged/i });
    this.staffTab = page.getByRole('button', { name: /personnel/i });
    this.chartTab = page.getByRole('button', { name: /organigramme/i });
    this.statsTab = page.getByRole('button', { name: /statistiques/i });

    // Info tab
    this.documentsCard = page.getByText('Documents Actifs');
    this.agentsCard = page.getByText('Agents Assignés');
    this.subUnitsCard = page.getByText('Sous-Unités');
    this.unitIdentitySection = page.getByText("Identité de l'Unité");

    // Staff tab
    this.staffTable = page.locator('table');
    this.staffRows = page.locator('table tbody tr');
    this.noAgentText = page.getByText('Aucun agent assigné');
    this.createUserButton = page.getByRole('button', { name: /créer un agent/i });

    // Chart tab
    this.chartView = page.getByText('Vue Hiérarchique');

    // Create Org modal
    this.orgModal = page.getByRole('dialog').filter({ hasText: /nouveau service racine/i });
    this.orgNameInput = this.orgModal.getByPlaceholder('Direction Générale');
    this.orgCodeInput = this.orgModal.getByPlaceholder('DG');
    this.orgSubmitButton = this.orgModal.getByRole('button', { name: /^créer$/i });

    // Formulaire « Nouvel agent » (/users) : libellés non reliés aux champs, ordre du formulaire.
    this.userModal = page.locator('.fixed.inset-0').filter({ has: page.getByRole('heading', { name: /nouvel agent/i }) });
    const agentForm = page.locator('form#agent-form');
    this.userMatriculeInput = agentForm.getByPlaceholder('MINFI001');
    this.userEmailInput = agentForm.getByPlaceholder('agent@minfi.gov.cm');
    this.userFirstNameInput = agentForm.locator('input').nth(2);
    this.userLastNameInput = agentForm.locator('input').nth(3);
    this.userRoleSelect = agentForm.locator('select').first();
    this.userSubmitButton = page.getByRole('button', { name: /créer l['’]agent/i });
    this.tempPasswordDialog = page.locator('.fixed.inset-0').filter({ hasText: /mot de passe temporaire/i });

    this.page = page;
  }

  async goto() {
    await this.page.goto('org');
  }

  async expectPageVisible() {
    await expect(this.hierarchyTitle).toBeVisible({ timeout: 10_000 });
  }

  async expectTreeLoaded() {
    await expect(this.loadingText).toBeHidden({ timeout: 15_000 });
  }

  async expectAtLeastOneNode() {
    await this.expectTreeLoaded();
    await expect(this.emptyTreeText).toBeHidden({ timeout: 5_000 });
    await expect(this.treeNodes.first()).toBeVisible();
  }

  // --- Tree interaction ---

  async selectTreeNode(name: string) {
    await this.page.locator(`.select-none`).getByText(name, { exact: false }).first().click();
  }

  async expectUnitSelected(name: string) {
    await expect(this.unitName).toContainText(name);
  }

  // --- Tabs ---

  async switchToStaffTab() {
    await this.staffTab.click();
    await expect(this.page.getByText('Effectif du Service')).toBeVisible();
  }

  async switchToChartTab() {
    await this.chartTab.click();
    await expect(this.chartView).toBeVisible();
  }

  async switchToInfoTab() {
    await this.infoTab.click();
    await expect(this.unitIdentitySection).toBeVisible();
  }

  // --- Create Org modal ---

  async openCreateOrgModal() {
    await this.newStructureButton.click();
    await expect(this.orgModal).toBeVisible();
  }

  async fillOrgForm(name: string, code: string) {
    await this.orgNameInput.fill(name);
    await this.orgCodeInput.fill(code);
  }

  async submitOrgForm() {
    await this.orgSubmitButton.click();
  }

  async expectOrgModalClosed() {
    await expect(this.orgModal).toBeHidden({ timeout: 10_000 });
  }

  // --- Create User modal ---

  async openCreateUserModal() {
    await this.switchToStaffTab();
    await this.createUserButton.click();
    await expect(this.page).toHaveURL(/\/users/);
    await expect(this.userModal).toBeVisible();
  }

  /** Remplit le formulaire « Nouvel agent » avec le premier rôle proposé. */
  async fillUserForm(matricule: string, email: string, firstName: string, lastName: string) {
    await this.userMatriculeInput.fill(matricule);
    await this.userEmailInput.fill(email);
    await this.userFirstNameInput.fill(firstName);
    await this.userLastNameInput.fill(lastName);
    await this.userRoleSelect.selectOption({ index: 1 });
  }

  async submitUserForm() {
    await this.userSubmitButton.click();
  }

  async expectUserModalClosed() {
    await expect(this.userModal).toBeHidden({ timeout: 10_000 });
  }
}
