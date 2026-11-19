import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page Object Model for the « Traitement des documents » page, « Règles automatiques » tab
 * (profiles/tenant-admin/pages/gedrules/RulesTab.tsx).
 * Covers: rule list, rule detail (code, targeting criteria, circuit), create modal, toggle active.
 */
export class RulesPage {
  readonly page: Page;

  // Header
  readonly heading: Locator;
  readonly subtitle: Locator;
  readonly simulationButton: Locator;
  readonly newRuleButton: Locator;
  readonly rulesTabButton: Locator;

  // Rule list (left column)
  readonly ruleCards: Locator;
  readonly loadingText: Locator;
  readonly emptyText: Locator;

  // Rule detail (right column): nothing is selected until a card is clicked
  readonly ruleCode: Locator;
  readonly criteriaBlock: Locator;
  readonly circuitBlock: Locator;
  readonly noSelectionText: Locator;

  // Create modal
  readonly createModal: Locator;
  readonly ruleNameInput: Locator;
  readonly ruleCodeHint: Locator;
  readonly ruleDescriptionInput: Locator;
  readonly categoryButtons: Locator;
  readonly templateSelect: Locator;
  readonly submitRuleButton: Locator;

  constructor(page: Page) {
    // Header
    this.heading = page.getByRole('heading', { name: /traitement des documents/i });
    this.subtitle = page.getByText(/comment les documents circulent/i);
    this.rulesTabButton = page.getByRole('button', { name: /règles automatiques/i });
    // In the current UI, simulation is a tab, not a mode toggle button.
    this.simulationButton = page.getByRole('button', { name: /simulat/i });
    this.newRuleButton = page.getByRole('button', { name: /nouvelle règle/i });

    // Rule list
    this.ruleCards = page.locator('.lg\\:w-1\\/3 > div.cursor-pointer').filter({ has: page.locator('h3') });
    this.loadingText = page.getByText('Chargement...');
    this.emptyText = page.getByText(/aucune règle pour l['’]instant/i);

    // Rule detail: each block is the parent of its own heading
    this.ruleCode = page.getByText(/^Code:/);
    this.criteriaBlock = page.getByRole('heading', { name: /critères de ciblage/i }).locator('..');
    this.circuitBlock = page.getByRole('heading', { name: /déclenchement du workflow/i }).locator('..');
    this.noSelectionText = page.getByRole('heading', { name: /à quoi sert une règle automatique/i });

    // Create modal
    this.createModal = page
      .locator('.fixed.inset-0')
      .filter({ has: page.getByRole('heading', { name: /nouvelle règle/i }) });
    this.ruleNameInput = this.createModal.getByPlaceholder(/factures direction financière/i);
    // The technical code is derived from the name; it is only shown, not typed.
    this.ruleCodeHint = this.createModal.getByText(/identifiant technique/i);
    this.ruleDescriptionInput = this.createModal.getByPlaceholder(/à quoi sert cette règle/i);
    this.categoryButtons = this.createModal
      .locator('label', { hasText: /types de documents ciblés/i })
      .locator('..')
      .getByRole('button');
    this.templateSelect = this.createModal.getByRole('combobox');
    this.submitRuleButton = this.createModal.getByRole('button', { name: /enregistrer la règle/i });

    this.page = page;
  }

  async goto() {
    await this.page.goto('rules');
  }

  async openRulesTab() {
    await this.rulesTabButton.click();
  }

  async expectPageVisible() {
    await expect(this.heading).toBeVisible({ timeout: 10_000 });
  }

  async expectLoaded() {
    await expect(this.loadingText).toBeHidden({ timeout: 15_000 });
  }

  async expectAtLeastOneRule() {
    await this.openRulesTab();
    await this.expectLoaded();
    await expect(this.ruleCards.first()).toBeVisible();
  }

  async expectNoRules() {
    await this.openRulesTab();
    await this.expectLoaded();
    await expect(this.emptyText).toBeVisible();
  }

  /** Counts the cards once the list has finished loading (a count during loading is always 0). */
  async getRuleCount() {
    await this.openRulesTab();
    await this.expectLoaded();
    return this.ruleCards.count();
  }

  // --- Rule selection ---

  async selectRule(name: string) {
    await this.ruleCards.filter({ has: this.page.locator('h3', { hasText: name }) }).first().click();
  }

  async selectFirstRule() {
    await this.ruleCards.first().click();
  }

  // --- Rule detail ---

  async expectEditorVisible() {
    await expect(this.ruleCode).toBeVisible();
    await expect(this.criteriaBlock).toBeVisible();
    await expect(this.circuitBlock).toBeVisible();
  }

  /** Name of the circuit the selected rule starts. */
  async getAppliedCircuit() {
    return this.circuitBlock.locator('p.text-lg').innerText();
  }

  /** Targeting criteria shown for the selected rule (document type, organisational unit). */
  async getCriteriaCount() {
    return this.criteriaBlock.getByText(/^(type de document|unité organisationnelle)$/i).count();
  }

  // --- Toggle active ---

  async toggleFirstRuleActive() {
    await this.openRulesTab();
    // `div` : l'interrupteur ; le bouton de suppression de la carte porte aussi ces classes.
    const toggle = this.ruleCards.first().locator('div.rounded-full.flex.items-center');
    await toggle.click();
  }

  // --- Simulation mode ---

  async toggleSimulation() {
    await this.simulationButton.click();
  }

  async expectSimulationActive() {
    await expect(this.simulationButton).toHaveClass(/bg-yellow-400/);
  }

  // --- Create modal ---

  async openCreateModal() {
    await this.openRulesTab();
    await this.newRuleButton.click();
    await expect(this.createModal).toBeVisible();
  }

  /** Fills the required fields: name (the code follows), one document type, one circuit. */
  async fillRuleForm(name: string, keyword: string, tag: string) {
    await this.ruleNameInput.fill(name);
    await this.ruleDescriptionInput.fill(`${keyword} ${tag}`.trim());
    await this.categoryButtons.first().click();
    // Option 0 is the « -- Sélectionner un circuit -- » placeholder.
    await this.templateSelect.selectOption({ index: 1 });
  }

  async submitRule() {
    await this.submitRuleButton.click();
  }

  async expectModalClosed() {
    await expect(this.createModal).toBeHidden({ timeout: 10_000 });
  }
}
