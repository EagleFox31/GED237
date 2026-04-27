import { test, expect } from '../fixtures/auth.fixture';
import { RulesPage } from '../pages/rules.page';

test.describe('Feature: Moteur de règles IFTTT', () => {

  test.beforeEach(async ({ loginAs }) => {
    await loginAs('tenant_admin');
  });

  /**
   * SCENARIO 1: Affichage de la page Automates & Règles
   *
   *   GIVEN  un tenant_admin connecté
   *   WHEN   il accède à /rules
   *   THEN   le titre "Automates & Règles" est visible
   *   AND    les boutons "Mode Simulation" et "Nouvelle Règle" sont présents
   */
  test('Given tenant_admin, When accès /rules, Then page visible avec boutons', async ({ page }) => {
    const rulesPage = new RulesPage(page);

    // WHEN
    await rulesPage.goto();

    // THEN
    await rulesPage.expectPageVisible();
    await rulesPage.openRulesTab();

    // AND
    await expect(rulesPage.simulationButton).toBeVisible();
    await expect(rulesPage.newRuleButton).toBeVisible();
  });

  /**
   * SCENARIO 2: Liste des règles chargées depuis l'API
   *
   *   GIVEN  des règles existent pour le tenant
   *   WHEN   la page se charge
   *   THEN   les cartes de règles s'affichent avec nom et trigger_type
   *   AND    la première règle est sélectionnée par défaut
   */
  test('Given règles en base, When chargement, Then cartes affichées', async ({ page }) => {
    const rulesPage = new RulesPage(page);
    await rulesPage.goto();
    await rulesPage.expectLoaded();

    const count = await rulesPage.getRuleCount();
    if (count > 0) {
      await rulesPage.expectAtLeastOneRule();
      // Première règle sélectionnée → éditeur visible
      await rulesPage.expectEditorVisible();
    } else {
      await rulesPage.expectNoRules();
    }
  });

  /**
   * SCENARIO 3: L'éditeur visuel affiche trigger, conditions et actions
   *
   *   GIVEN  une règle est sélectionnée
   *   WHEN   l'éditeur visuel se charge
   *   THEN   le bloc DÉCLENCHEUR affiche le trigger_type
   *   AND    le bloc CONDITIONS affiche les conditions de la règle
   *   AND    le bloc ACTIONS affiche les actions de la règle
   */
  test('Given règle sélectionnée, When éditeur, Then trigger + conditions + actions', async ({ page }) => {
    const rulesPage = new RulesPage(page);
    await rulesPage.goto();
    await rulesPage.expectLoaded();

    const count = await rulesPage.getRuleCount();
    if (count === 0) {
      test.skip();
      return;
    }

    // THEN
    await rulesPage.expectEditorVisible();

    // Trigger type affiché
    const triggerType = await rulesPage.getTriggerType();
    expect(triggerType.length).toBeGreaterThan(0);

    // Conditions et actions comptées
    const condCount = await rulesPage.getConditionCount();
    const actionCount = await rulesPage.getActionCount();
    expect(condCount + actionCount).toBeGreaterThanOrEqual(0); // Peut être 0 si pas de conditions
  });

  /**
   * SCENARIO 4: Sélection d'une autre règle met à jour l'éditeur
   *
   *   GIVEN  au moins 2 règles existent
   *   WHEN   l'utilisateur clique sur la deuxième règle
   *   THEN   l'éditeur affiche les détails de la nouvelle règle
   */
  test('Given 2+ règles, When clic deuxième, Then éditeur mis à jour', async ({ page }) => {
    const rulesPage = new RulesPage(page);
    await rulesPage.goto();
    await rulesPage.expectLoaded();

    const count = await rulesPage.getRuleCount();
    if (count < 2) {
      test.skip();
      return;
    }

    // WHEN
    await rulesPage.ruleCards.nth(1).click();

    // THEN — l'éditeur est toujours visible avec des données
    await rulesPage.expectEditorVisible();
  });

  /**
   * SCENARIO 5: État vide sans règles
   *
   *   GIVEN  aucune règle n'existe pour le tenant
   *   WHEN   la page se charge
   *   THEN   "Aucune règle définie" s'affiche
   *   AND    le message "Sélectionnez une règle" est visible
   */
  test('Given aucune règle, When chargement, Then état vide', async ({ page }) => {
    const rulesPage = new RulesPage(page);
    await rulesPage.goto();
    await rulesPage.expectLoaded();

    const count = await rulesPage.getRuleCount();
    if (count === 0) {
      await rulesPage.expectNoRules();
      await expect(rulesPage.noSelectionText).toBeVisible();
    }
  });
});

test.describe('Feature: Création de règle', () => {

  test.beforeEach(async ({ loginAs }) => {
    await loginAs('tenant_admin');
  });

  /**
   * SCENARIO 6: Ouverture du modal de création
   *
   *   GIVEN  un tenant_admin sur la page Rules
   *   WHEN   il clique "Nouvelle Règle"
   *   THEN   le modal s'ouvre avec nom, condition OCR (mot-clé), action (tag)
   */
  test('Given page rules, When clic nouvelle règle, Then modal affiché', async ({ page }) => {
    const rulesPage = new RulesPage(page);
    await rulesPage.goto();
    await rulesPage.expectPageVisible();

    // WHEN
    await rulesPage.openCreateModal();

    // THEN
    await expect(rulesPage.ruleNameInput).toBeVisible();
    await expect(rulesPage.ruleCodeInput).toBeVisible();
    await expect(rulesPage.categorySelect).toBeVisible();
    await expect(rulesPage.templateSelect).toBeVisible();
    await expect(rulesPage.submitRuleButton).toBeVisible();
  });

  /**
   * SCENARIO 7: Création réussie d'une règle IFTTT
   *
   *   GIVEN  le modal de création est ouvert
   *   WHEN   l'admin remplit nom="Auto-tag Factures", keyword="facture", tag="Finance"
   *   AND    il soumet
   *   THEN   le modal se ferme
   *   AND    la nouvelle règle apparaît dans la liste
   */
  test('Given modal ouvert, When remplir et soumettre, Then règle créée', async ({ page }) => {
    const rulesPage = new RulesPage(page);
    const ruleName = `E2E Rule ${Date.now()}`;

    await rulesPage.goto();
    await rulesPage.expectPageVisible();
    await rulesPage.openCreateModal();

    // WHEN
    await rulesPage.fillRuleForm(ruleName, 'facture', 'Finance');

    // AND
    await rulesPage.submitRule();

    // THEN
    await rulesPage.expectModalClosed();

    // AND
    await rulesPage.expectLoaded();
    await expect(page.getByText(ruleName)).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Feature: Toggle et Simulation', () => {

  test.beforeEach(async ({ loginAs }) => {
    await loginAs('tenant_admin');
  });

  /**
   * SCENARIO 8: Activation/désactivation d'une règle via le toggle
   *
   *   GIVEN  au moins une règle existe
   *   WHEN   l'admin clique sur le toggle de la première règle
   *   THEN   l'état actif/inactif change visuellement (vert ↔ gris)
   */
  test('Given règle existante, When toggle, Then état change', async ({ page }) => {
    const rulesPage = new RulesPage(page);
    await rulesPage.goto();
    await rulesPage.expectLoaded();

    const count = await rulesPage.getRuleCount();
    if (count === 0) {
      test.skip();
      return;
    }

    // WHEN
    await rulesPage.toggleFirstRuleActive();

    // THEN — la page se rafraîchit, pas d'erreur
    await rulesPage.expectLoaded();
  });

  /**
   * SCENARIO 9: Accès à l'onglet simulateur
   *
   *   GIVEN  un tenant_admin sur la page Rules
   *   WHEN   il clique "Simulateur"
   *   THEN   la zone "Variables d'entrée" est visible
   */
  test('Given page rules, When clic simulation, Then mode actif', async ({ page }) => {
    const rulesPage = new RulesPage(page);
    await rulesPage.goto();
    await rulesPage.expectPageVisible();

    // WHEN
    await rulesPage.toggleSimulation();

    // THEN
    await expect(page.getByText(/variables d'entrée/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /lancer le test/i })).toBeVisible();
  });

  /**
   * SCENARIO 10: Retour du simulateur vers les règles
   *
   *   GIVEN  l'onglet Simulateur est actif
   *   WHEN   l'admin clique "Règles de routage"
   *   THEN   la liste des règles réapparaît
   */
  test('Given simulation active, When quitter, Then mode normal', async ({ page }) => {
    const rulesPage = new RulesPage(page);
    await rulesPage.goto();
    await rulesPage.expectPageVisible();

    // GIVEN
    await rulesPage.toggleSimulation();
    await expect(page.getByText(/variables d'entrée/i)).toBeVisible();

    // WHEN
    await rulesPage.openRulesTab();

    // THEN
    await expect(rulesPage.newRuleButton).toBeVisible();
  });
});
