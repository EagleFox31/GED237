import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page Object Model for WorkflowTasks (components/WorkflowTasks.tsx).
 * Shared view for users with pending validations.
 */
export class WorkflowTasksPage {
  readonly page: Page;

  // Header
  readonly heading: Locator;
  readonly subtitle: Locator;

  // Task list
  readonly taskCards: Locator;
  readonly emptyState: Locator;
  readonly loadingSpinner: Locator;
  readonly errorMessage: Locator;

  // Per-task actions (first card)
  readonly approveButton: Locator;
  readonly rejectButton: Locator;

  // Performance chart placeholder
  readonly chartPlaceholder: Locator;

  constructor(page: Page) {
    this.heading = page.getByRole('heading', { name: /tâches.*validations/i });
    this.subtitle = page.getByText(/circuits de signature/i);

    this.taskCards = page.locator('.grid > div.glass');
    this.emptyState = page.getByText('Aucune tâche en attente');
    this.loadingSpinner = page.locator('.animate-spin');
    this.errorMessage = page.getByText('Impossible de charger les tâches en attente.');

    this.approveButton = page.getByRole('button', { name: /valider|viser|approuver|signer/i }).first();
    this.rejectButton = page.getByRole('button', { name: /^rejeter$/i }).first();

    this.chartPlaceholder = page.getByText(/efficacité du service/i);

    this.page = page;
  }

  async goto() {
    await this.page.goto('tasks');
  }

  async expectPageVisible() {
    await expect(this.heading).toBeVisible({ timeout: 10_000 });
  }

  async expectLoaded() {
    await expect(this.loadingSpinner).toBeHidden({ timeout: 15_000 });
  }

  async expectAtLeastOneTask() {
    await this.expectLoaded();
    await expect(this.taskCards.first()).toBeVisible();
  }

  async expectNoTasks() {
    await this.expectLoaded();
    await expect(this.emptyState).toBeVisible();
  }

  async getTaskCount() {
    return this.taskCards.count();
  }

  async getTaskLabel(index: number) {
    return this.taskCards.nth(index).locator('h3').innerText();
  }

  async approveFirstTask() {
    await this.approveButton.click();
  }

  async rejectFirstTask() {
    await this.rejectButton.click();
  }
}

/**
 * Page Object Model for ValidationHub (profiles/manager/pages/ValidationHub.tsx).
 * Manager-specific parapheur with confirm dialogs.
 */
export class ValidationHubPage {
  readonly page: Page;

  // Header
  readonly heading: Locator;
  readonly subtitle: Locator;

  // Cards
  readonly documentCards: Locator;
  readonly emptyState: Locator;
  readonly loadingText: Locator;

  constructor(page: Page) {
    this.heading = page.getByRole('heading', { name: /espace manager/i });
    this.subtitle = page.getByText(/validez et signez/i);

    this.documentCards = page.locator('.grid > div.glass');
    this.emptyState = page.getByText('Aucun dossier en attente');
    this.loadingText = page.getByText('Chargement du parapheur...');

    this.page = page;
  }

  async expectPageVisible() {
    await expect(this.heading).toBeVisible({ timeout: 10_000 });
  }

  async expectLoaded() {
    await expect(this.loadingText).toBeHidden({ timeout: 15_000 });
  }

  async expectAtLeastOneDocument() {
    await this.expectLoaded();
    await expect(this.documentCards.first()).toBeVisible();
  }

  async expectNoDocuments() {
    await this.expectLoaded();
    await expect(this.emptyState).toBeVisible();
  }

  async getDocumentCount() {
    return this.documentCards.count();
  }

  async approveDocument(index: number) {
    // ValidationHub uses confirm() dialog
    this.page.on('dialog', dialog => dialog.accept());
    await this.documentCards
      .nth(index)
      .getByRole('button', { name: /valider|viser|approuver|signer|j'ai pris connaissance/i })
      .click();
  }

  async rejectDocument(index: number) {
    this.page.on('dialog', dialog => dialog.accept());
    await this.documentCards.nth(index).getByRole('button', { name: /rejeter/i }).click();
  }

  async getDocumentTitle(index: number) {
    return this.documentCards.nth(index).locator('h4').innerText();
  }
}
