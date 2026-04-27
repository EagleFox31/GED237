import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page Object Model for the Documents explorer (components/Documents.tsx)
 * including the new UploadDocumentModal.
 */
export class DocumentsPage {
  readonly page: Page;

  // Header
  readonly heading: Locator;
  readonly uploadButton: Locator;

  // Search & Filters
  readonly searchInput: Locator;
  readonly categoryFilter: Locator;
  readonly statusFilter: Locator;

  // Document grid
  readonly documentCards: Locator;
  readonly emptyState: Locator;
  readonly loadingSpinner: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.heading = page.getByRole('heading', { name: /explorateur.*ged/i });
    this.uploadButton = page.getByRole('button', { name: /nouveau document/i });

    this.searchInput = page.getByPlaceholder(/rechercher par nom/i);
    this.categoryFilter = page.locator('select').nth(0);
    this.statusFilter = page.locator('select').nth(1);

    this.documentCards = page.locator('.grid > div.glass, .grid > div[class*="rounded"]').filter({ has: page.locator('h4,h3') });
    this.emptyState = page.getByText('Aucun document trouvé.');
    this.loadingSpinner = page.locator('.animate-spin');
    this.errorMessage = page.getByText('Impossible de charger les documents.');

    this.page = page;
  }

  async goto() {
    await this.page.goto('documents');
  }

  async expectPageVisible() {
    await expect(this.heading).toBeVisible({ timeout: 10_000 });
  }

  async expectDocumentsLoaded() {
    // Wait for spinner to disappear
    await expect(this.loadingSpinner).toBeHidden({ timeout: 15_000 });
    await expect(this.errorMessage).toBeHidden();
  }

  async getDocumentCount() {
    return this.documentCards.count();
  }

  async expectAtLeastOneDocument() {
    await this.expectDocumentsLoaded();
    await expect(this.documentCards.first()).toBeVisible();
  }

  async expectEmptyState() {
    await this.expectDocumentsLoaded();
    await expect(this.emptyState).toBeVisible();
  }

  async clickDocument(title: string) {
    await this.page.locator('.grid > div.glass').filter({ hasText: title }).click();
  }

  async clickFirstDocument() {
    await this.documentCards.first().click();
  }

  async expectDocumentCardContains(title: string) {
    await expect(this.page.locator('.grid > div.glass').filter({ hasText: title })).toBeVisible();
  }

  async searchDocuments(query: string) {
    await this.searchInput.fill(query);
  }

  async filterByCategory(category: string) {
    await this.categoryFilter.selectOption({ label: category });
  }

  async filterByStatus(status: string) {
    await this.statusFilter.selectOption({ label: status });
  }
}

/**
 * Page Object for the UploadDocumentModal (components/UploadDocumentModal.tsx)
 * Triggered from the Documents explorer via the "Nouveau Document" button.
 */
export class UploadDocumentModalPage {
  readonly page: Page;

  readonly modal: Locator;
  readonly dropZone: Locator;
  readonly fileInput: Locator;
  readonly titleInput: Locator;
  readonly categorySelect: Locator;
  readonly tagsInput: Locator;
  readonly descriptionInput: Locator;
  readonly submitButton: Locator;
  readonly cancelButton: Locator;
  readonly closeButton: Locator;
  readonly errorMessage: Locator;
  readonly loadingSpinner: Locator;

  constructor(page: Page) {
    this.page = page;
    this.modal = page.locator('.fixed.inset-0').filter({ hasText: 'Nouveau Document' });
    this.dropZone = this.modal.locator('[class*="border-dashed"]');
    this.fileInput = this.modal.locator('input[type="file"]');
    this.titleInput = this.modal.locator('input[placeholder*="Nom du document"], input[placeholder*="document"]').first();
    this.categorySelect = this.modal.locator('select');
    this.tagsInput = this.modal.locator('input[placeholder*="budget"]');
    this.descriptionInput = this.modal.locator('textarea');
    this.submitButton = this.modal.getByRole('button', { name: /envoyer|créer le document/i });
    this.cancelButton = this.modal.getByRole('button', { name: /annuler/i });
    this.closeButton = this.modal.locator('button').filter({ has: page.locator('span:text("close")') });
    this.errorMessage = this.modal.locator('.bg-red-50');
    this.loadingSpinner = this.modal.locator('.animate-spin');
  }

  async expectVisible() {
    await expect(this.modal).toBeVisible({ timeout: 5_000 });
  }

  async expectHidden() {
    await expect(this.modal).toBeHidden({ timeout: 10_000 });
  }

  async setFile(filePath: string) {
    await this.fileInput.setInputFiles(filePath);
  }

  async fillTitle(title: string) {
    await this.titleInput.fill(title);
  }

  async selectCategory(value: string) {
    await this.categorySelect.selectOption(value);
  }

  async fillTags(tags: string) {
    await this.tagsInput.fill(tags);
  }

  async fillDescription(desc: string) {
    await this.descriptionInput.fill(desc);
  }

  async submit() {
    await this.submitButton.click();
  }

  async cancel() {
    await this.cancelButton.click();
  }

  async expectErrorContaining(text: string) {
    await expect(this.errorMessage).toBeVisible({ timeout: 5_000 });
    await expect(this.errorMessage).toContainText(text);
  }

  async expectSubmitDisabled() {
    await expect(this.submitButton).toBeDisabled();
  }

  async expectSubmitEnabled() {
    await expect(this.submitButton).toBeEnabled();
  }

  async isLoading() {
    return this.loadingSpinner.isVisible();
  }
}

/**
 * Page Object for the DraftWorkspace (collaborator upload flow).
 * Located at /dashboard for collaborator role.
 */
export class DraftWorkspacePage {
  readonly page: Page;

  // Header
  readonly heading: Locator;
  readonly newDocButton: Locator;

  // Document grid
  readonly documentCards: Locator;
  readonly emptyState: Locator;
  readonly loadingText: Locator;

  // Upload modal
  readonly uploadModal: Locator;
  readonly titleInput: Locator;
  readonly categorySelect: Locator;
  readonly tagsInput: Locator;
  readonly fileInput: Locator;
  readonly createButton: Locator;
  readonly closeModalButton: Locator;

  // Submit to workflow modal
  readonly submitModal: Locator;
  readonly validatorSelect: Locator;
  readonly submitWorkflowButton: Locator;

  constructor(page: Page) {
    this.heading = page.getByRole('heading', { name: /mon atelier/i });
    this.newDocButton = page.getByRole('button', { name: /nouveau document/i });

    this.documentCards = page.locator('.grid > div.glass, .grid > div[class*="rounded"]').filter({ has: page.locator('h4') });
    this.emptyState = page.getByText('Aucun document en cours');
    this.loadingText = page.getByText('Chargement de vos brouillons...');

    // Upload modal
    this.uploadModal = page.locator('.fixed.inset-0').filter({ hasText: 'Nouveau Document' });
    this.titleInput = page.locator('input[name="title"]');
    this.categorySelect = page.locator('select[name="category"]');
    this.tagsInput = page.locator('input[name="tags"]');
    this.fileInput = page.locator('input[name="file"]');
    this.createButton = this.uploadModal.getByRole('button', { name: /créer le document|envoyer/i });
    this.closeModalButton = page.locator('.fixed.inset-0 button:has(span.material-symbols-outlined:text("close"))');

    // Submit workflow modal
    this.submitModal = page.locator('.fixed.inset-0').filter({ hasText: 'Circuit de Validation' });
    this.validatorSelect = this.submitModal.locator('select');
    this.submitWorkflowButton = page.getByRole('button', { name: /soumettre au visa/i });

    this.page = page;
  }

  async expectPageVisible() {
    await expect(this.heading).toBeVisible({ timeout: 10_000 });
  }

  async expectDocumentsLoaded() {
    await expect(this.loadingText).toBeHidden({ timeout: 15_000 });
  }

  async openUploadModal() {
    await this.newDocButton.click();
    await expect(this.uploadModal).toBeVisible();
  }

  async fillUploadForm(title: string, category: string, tags: string, filePath: string) {
    await this.titleInput.fill(title);
    await this.categorySelect.selectOption(category);
    await this.tagsInput.fill(tags);
    await this.fileInput.setInputFiles(filePath);
  }

  async submitUpload() {
    await this.createButton.click();
  }

  async expectUploadModalClosed() {
    await expect(this.uploadModal).toBeHidden({ timeout: 10_000 });
  }

  async clickSubmitToWorkflow(docTitle: string) {
    const card = this.page.locator('.grid > div.glass').filter({ hasText: docTitle });
    await card.getByRole('button', { name: /soumettre/i }).click();
    await expect(this.submitModal).toBeVisible();
  }

  async selectValidatorAndSubmit(validatorName: string) {
    await this.validatorSelect.selectOption({ label: validatorName });
    await this.submitWorkflowButton.click();
  }
}
