import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page Object Model for the DocumentDetailModal (components/DocumentDetailModal.tsx).
 * Modal with 3 tabs: Info, Workflow, History.
 */
export class DocumentDetailModal {
  readonly page: Page;

  // Modal container
  readonly modal: Locator;
  readonly backdrop: Locator;

  // Header
  readonly documentTitle: Locator;
  readonly closeButton: Locator;

  // Tabs
  readonly infoTab: Locator;
  readonly workflowTab: Locator;
  readonly historyTab: Locator;

  // Info tab content
  readonly metadataSection: Locator;
  readonly ownerField: Locator;
  readonly categoryField: Locator;
  readonly versionField: Locator;
  readonly fileSizeField: Locator;
  readonly tags: Locator;
  readonly downloadButton: Locator;
  readonly shareButton: Locator;

  // Workflow tab content
  readonly workflowSteps: Locator;
  readonly workflowEmpty: Locator;
  readonly workflowLoading: Locator;
  readonly approveButton: Locator;
  readonly rejectButton: Locator;

  // Footer
  readonly signButton: Locator;
  readonly closeFooterButton: Locator;

  constructor(page: Page) {
    this.modal = page.locator('.fixed.inset-0').filter({ has: page.getByText('Métadonnées Officielles').or(page.getByText('Circuit de Validation')).or(page.getByText('Détails & Aperçu')) });
    this.backdrop = page.locator('.fixed.inset-0 .bg-slate-900\\/40');

    // Header
    this.documentTitle = page.locator('.fixed.inset-0 h2');
    this.closeButton = page.locator('.fixed.inset-0 button:has(svg path)').first();

    // Tabs
    this.infoTab = page.getByRole('button', { name: /détails.*aperçu/i });
    this.workflowTab = page.getByRole('button', { name: /circuit de validation/i });
    this.historyTab = page.getByRole('button', { name: /historique des versions/i });

    // Info content
    this.metadataSection = page.getByText('Métadonnées Officielles');
    this.ownerField = page.locator('text=Propriétaire').locator('..').locator('p.font-bold');
    this.categoryField = page.locator('text=Catégorie').locator('..').locator('p.font-bold');
    this.versionField = page.locator('text=Version').locator('..').locator('p.font-bold');
    this.fileSizeField = page.locator('text=Taille').locator('..').locator('p.font-bold');
    this.tags = page.locator('span:has-text("#")');
    this.downloadButton = page.getByRole('button', { name: /télécharger/i });
    this.shareButton = page.getByRole('button', { name: /partager/i });

    // Workflow content
    this.workflowSteps = page.locator('.relative.flex.items-start.gap-8');
    this.workflowEmpty = page.getByText('Aucune étape de workflow définie.');
    this.workflowLoading = page.locator('.fixed.inset-0 .animate-spin');
    this.approveButton = page.getByRole('button', { name: /valider/i });
    this.rejectButton = page.getByRole('button', { name: /rejeter/i });

    // Footer
    this.signButton = page.getByRole('button', { name: /signer numériquement/i });
    this.closeFooterButton = page.getByRole('button', { name: /fermer/i });

    this.page = page;
  }

  async expectModalVisible() {
    await expect(this.documentTitle).toBeVisible({ timeout: 5_000 });
  }

  async expectModalHidden() {
    await expect(this.documentTitle).toBeHidden({ timeout: 5_000 });
  }

  async expectTitleToBe(title: string) {
    await expect(this.documentTitle).toContainText(title);
  }

  // --- Tab navigation ---

  async switchToInfoTab() {
    await this.infoTab.click();
    await expect(this.metadataSection).toBeVisible();
  }

  async switchToWorkflowTab() {
    await this.workflowTab.click();
    // Wait for loading to finish
    await expect(this.workflowLoading).toBeHidden({ timeout: 10_000 });
  }

  async switchToHistoryTab() {
    await this.historyTab.click();
    await expect(this.page.getByText(/fonctionnalité à venir/i)).toBeVisible();
  }

  // --- Info tab assertions ---

  async expectMetadataVisible() {
    await expect(this.metadataSection).toBeVisible();
  }

  async expectCategoryToBe(category: string) {
    await expect(this.categoryField).toContainText(category);
  }

  // --- Workflow tab ---

  async expectWorkflowStepsVisible() {
    await expect(this.workflowSteps.first()).toBeVisible();
  }

  async expectNoWorkflowSteps() {
    await expect(this.workflowEmpty).toBeVisible();
  }

  async getWorkflowStepCount() {
    return this.workflowSteps.count();
  }

  async approveCurrentStep() {
    await this.approveButton.click();
  }

  async rejectCurrentStep() {
    await this.rejectButton.click();
  }

  // --- Close ---

  async close() {
    await this.closeFooterButton.click();
  }

  async closeViaBackdrop() {
    await this.backdrop.click({ position: { x: 10, y: 10 } });
  }
}
