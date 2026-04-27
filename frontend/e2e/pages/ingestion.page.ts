import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page Object Model for DirectoryIngestion (profiles/tenant-admin/pages/DirectoryIngestion.tsx).
 */
export class IngestionPage {
  readonly page: Page;

  // Header
  readonly heading: Locator;
  readonly badge: Locator;

  // Config form
  readonly directoryInput: Locator;
  readonly categorySelect: Locator;
  readonly recursiveCheckbox: Locator;
  readonly ingestButton: Locator;
  readonly errorMessage: Locator;
  readonly loadingSpinner: Locator;

  // Supported formats
  readonly formatsSection: Locator;

  // Results
  readonly summaryCards: Locator;
  readonly totalFoundCard: Locator;
  readonly importedCard: Locator;
  readonly skippedCard: Locator;
  readonly errorsCard: Locator;
  readonly importedFilesList: Locator;
  readonly errorsList: Locator;

  constructor(page: Page) {
    // Header
    this.heading = page.getByText('Ingestion Répertoire');
    this.badge = page.getByText('Import en Masse');

    // Config form
    this.directoryInput = page.getByPlaceholder(/Documents.*Inbox/i);
    this.categorySelect = page.locator('select').filter({ hasText: /aucune.*classement/i });
    this.recursiveCheckbox = page.locator('input[type="checkbox"]');
    this.ingestButton = page.getByRole('button', { name: /lancer l'ingestion/i });
    this.errorMessage = page.locator('.bg-red-50.border-red-100 p.text-red-600');
    this.loadingSpinner = page.locator('.animate-spin');

    // Formats
    this.formatsSection = page.getByText('Formats pris en charge');

    // Results
    this.summaryCards = page.locator('.glass.text-center');
    this.totalFoundCard = page.getByText('Fichiers trouvés');
    this.importedCard = page.getByText(/^importés$/i);
    this.skippedCard = page.getByText(/^ignorés$/i);
    this.errorsCard = page.getByText(/^erreurs$/i).first();
    this.importedFilesList = page.getByText(/documents importés/i);
    this.errorsList = page.locator('.bg-red-50\\/50').filter({ hasText: /erreurs/i });

    this.page = page;
  }

  async goto() {
    await this.page.goto('ingestion');
  }

  async expectPageVisible() {
    await expect(this.heading).toBeVisible({ timeout: 10_000 });
  }

  async fillDirectoryPath(path: string) {
    await this.directoryInput.fill(path);
  }

  async selectCategory(category: string) {
    await this.categorySelect.selectOption(category);
  }

  async toggleRecursive() {
    await this.recursiveCheckbox.click();
  }

  async startIngestion() {
    await this.ingestButton.click();
  }

  async expectIngesting() {
    await expect(this.loadingSpinner).toBeVisible();
  }

  async expectResultsVisible() {
    await expect(this.totalFoundCard).toBeVisible({ timeout: 30_000 });
  }

  async expectErrorMessage(text?: string) {
    await expect(this.errorMessage).toBeVisible();
    if (text) {
      await expect(this.errorMessage).toContainText(text);
    }
  }

  async expectButtonDisabled() {
    await expect(this.ingestButton).toBeDisabled();
  }

  async expectButtonEnabled() {
    await expect(this.ingestButton).toBeEnabled();
  }
}
