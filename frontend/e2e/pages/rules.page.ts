import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page Object Model for GEDRulesPage (profiles/tenant-admin/pages/GEDRulesPage.tsx).
 * Covers: rule list, visual editor (trigger/conditions/actions), create modal, toggle active.
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

  // Visual editor (right column)
  readonly triggerBlock: Locator;
  readonly conditionsBlock: Locator;
  readonly actionsBlock: Locator;
  readonly noSelectionText: Locator;

  // Create modal
  readonly createModal: Locator;
  readonly ruleNameInput: Locator;
  readonly ruleCodeInput: Locator;
  readonly ruleDescriptionInput: Locator;
  readonly categorySelect: Locator;
  readonly templateSelect: Locator;
  readonly submitRuleButton: Locator;
  readonly closeModalButton: Locator;

  constructor(page: Page) {
    // Header
    this.heading = page.getByRole('heading', { name: /paramétrage ged.*classement|routage automatique|automates.*règles/i });
    this.subtitle = page.getByText(/configuration des modèles|classement automatique|circuits workflow/i);
    this.rulesTabButton = page.getByRole('button', { name: /règles de routage/i });
    // In the current UI, simulation is a tab, not a mode toggle button.
    this.simulationButton = page.getByRole('button', { name: /simulat/i });
    this.newRuleButton = page.getByRole('button', { name: /nouvelle règle/i });

    // Rule list
    this.ruleCards = page
      .locator('.lg\\:w-1\\/3 > div.cursor-pointer, .lg\\:w-1\\/3 > div[class*="rounded-"]')
      .filter({ has: page.locator('h3') });
    this.loadingText = page.getByText('Chargement...');
    this.emptyText = page.getByText(/aucune règle définie|aucune règle configurée/i);

    // Visual editor blocks
    this.triggerBlock = page.locator('.bg-white,.bg-slate-50').filter({ hasText: /déclencheur|critères de ciblage/i });
    this.conditionsBlock = page.locator('.bg-white,.bg-slate-50').filter({ hasText: /conditions|catégorie|unité organisationnelle/i });
    this.actionsBlock = page.locator('.bg-blue-50,.border-blue-100').filter({ hasText: /action|workflow/i });
    this.noSelectionText = page.getByText(/sélectionnez une règle pour voir le routage|sélectionnez une règle/i);

    // Create modal
    this.createModal = page.locator('.fixed.inset-0').filter({ hasText: 'Nouvelle Règle' });
    this.ruleCodeInput = this.createModal.locator('input').nth(0);
    this.ruleNameInput = this.createModal.locator('input').nth(1);
    this.ruleDescriptionInput = this.createModal.locator('input').nth(2);
    this.categorySelect = this.createModal.locator('select').nth(0);
    this.templateSelect = this.createModal.locator('select').nth(2);
    this.submitRuleButton = this.createModal.getByRole('button', { name: /enregistrer la règle/i });
    this.closeModalButton = this.createModal.locator('button:has(span:text("close"))');

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

  async getRuleCount() {
    await this.openRulesTab();
    return this.ruleCards.count();
  }

  // --- Rule selection ---

  async selectRule(name: string) {
    await this.page.locator(`h3:has-text("${name}")`).click();
  }

  async selectFirstRule() {
    await this.ruleCards.first().click();
  }

  // --- Visual editor ---

  async expectEditorVisible() {
    await expect(this.triggerBlock).toBeVisible();
    await expect(this.conditionsBlock).toBeVisible();
    await expect(this.actionsBlock).toBeVisible();
  }

  async getTriggerType() {
    return this.triggerBlock.locator('.font-bold.text-sm').innerText();
  }

  async getConditionCount() {
    return this.conditionsBlock.locator('.flex.items-center.gap-3.p-3').count();
  }

  async getActionCount() {
    return this.actionsBlock.locator('.flex.items-center.gap-3.p-3').count();
  }

  // --- Toggle active ---

  async toggleFirstRuleActive() {
    await this.openRulesTab();
    const toggle = this.ruleCards.first().locator('.rounded-full.flex.items-center');
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

  async fillRuleForm(name: string, keyword: string, tag: string) {
    const safeCode = `R_${Date.now().toString().slice(-6)}`;
    await this.ruleCodeInput.fill(safeCode);
    await this.ruleNameInput.fill(name);
    await this.ruleDescriptionInput.fill(`${keyword} ${tag}`.trim());

    // Select first available category/template required by current UI.
    await this.categorySelect.selectOption({ index: 1 });
    await this.templateSelect.selectOption({ index: 1 });
  }

  async submitRule() {
    await this.submitRuleButton.click();
  }

  async expectModalClosed() {
    await expect(this.createModal).toBeHidden({ timeout: 10_000 });
  }
}
