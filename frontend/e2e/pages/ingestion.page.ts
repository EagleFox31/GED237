import { type Locator, type Page, expect } from '@playwright/test';

export class IngestionPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly badge: Locator;
  readonly directoryInput: Locator;
  readonly filesInput: Locator;
  readonly analyzeButton: Locator;
  readonly commitButton: Locator;
  readonly recursiveCheckbox: Locator;
  readonly formatsSection: Locator;
  readonly previewTable: Locator;
  readonly importedSection: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: /import batch pilote/i });
    this.badge = page.getByText('Sprint 4');
    this.directoryInput = page.locator('input[type="file"]').nth(0);
    this.filesInput = page.locator('input[type="file"]').nth(1);
    this.analyzeButton = page.getByRole('button', { name: /analyser le lot/i });
    this.commitButton = page.getByRole('button', { name: /lancer l'import/i });
    this.recursiveCheckbox = page.locator('input[type="checkbox"]');
    this.formatsSection = page.getByText('Formats pris en charge');
    this.previewTable = page.locator('table');
    this.importedSection = page.getByText(/documents importes/i);
    this.errorMessage = page.locator('.bg-red-50.border-red-100 p.text-red-600');
  }

  async goto() {
    await this.page.goto('ingestion');
  }

  async expectPageVisible() {
    await expect(this.heading).toBeVisible({ timeout: 10000 });
    await expect(this.badge).toBeVisible();
  }

  async uploadFiles(files: Array<{ name: string; mimeType: string; buffer: Buffer }>) {
    await this.filesInput.setInputFiles(files);
  }

  async clickAnalyze() {
    await this.analyzeButton.click();
  }

  async clickCommit() {
    await this.commitButton.click();
  }

  async expectAnalyzeDisabled() {
    await expect(this.analyzeButton).toBeDisabled();
  }

  async expectAnalyzeEnabled() {
    await expect(this.analyzeButton).toBeEnabled();
  }

  async expectCommitDisabled() {
    await expect(this.commitButton).toBeDisabled();
  }

  async expectCommitEnabled() {
    await expect(this.commitButton).toBeEnabled();
  }
}
