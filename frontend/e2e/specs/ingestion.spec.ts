import { test, expect } from '../fixtures/auth.fixture';
import { IngestionPage } from '../pages/ingestion.page';

test.describe('Feature: Ingestion de répertoire', () => {

  test.beforeEach(async ({ loginAs }) => {
    await loginAs('tenant_admin');
  });

  /**
   * SCENARIO 1: Affichage de la page d'ingestion
   *
   *   GIVEN  un tenant_admin connecté
   *   WHEN   il accède à /ingestion
   *   THEN   le titre "Ingestion Répertoire" et le badge "Import en Masse" sont visibles
   *   AND    le formulaire de configuration est affiché
   */
  test('Given tenant_admin, When accès /ingestion, Then page visible', async ({ page }) => {
    const ingestion = new IngestionPage(page);

    // WHEN
    await ingestion.goto();

    // THEN
    await ingestion.expectPageVisible();
    await expect(ingestion.badge).toBeVisible();

    // AND
    await expect(ingestion.directoryInput).toBeVisible();
    await expect(ingestion.categorySelect).toBeVisible();
    await expect(ingestion.recursiveCheckbox).toBeVisible();
    await expect(ingestion.ingestButton).toBeVisible();
  });

  /**
   * SCENARIO 2: Bouton désactivé si chemin vide
   *
   *   GIVEN  le champ chemin est vide
   *   WHEN   on regarde le bouton
   *   THEN   il est désactivé
   */
  test('Given chemin vide, When vue bouton, Then désactivé', async ({ page }) => {
    const ingestion = new IngestionPage(page);
    await ingestion.goto();
    await ingestion.expectPageVisible();

    // THEN
    await ingestion.expectButtonDisabled();
  });

  /**
   * SCENARIO 3: Bouton activé après saisie du chemin
   *
   *   GIVEN  le champ chemin est vide
   *   WHEN   l'admin saisit un chemin
   *   THEN   le bouton devient actif
   */
  test('Given chemin vide, When saisir chemin, Then bouton activé', async ({ page }) => {
    const ingestion = new IngestionPage(page);
    await ingestion.goto();

    // WHEN
    await ingestion.fillDirectoryPath('/tmp/test-ingestion');

    // THEN
    await ingestion.expectButtonEnabled();
  });

  /**
   * SCENARIO 4: Case "Scanner les sous-dossiers" cochée par défaut
   *
   *   GIVEN  la page d'ingestion est chargée
   *   WHEN   on regarde la checkbox récursive
   *   THEN   elle est cochée par défaut
   */
  test('Given page chargée, When checkbox recursive, Then cochée par défaut', async ({ page }) => {
    const ingestion = new IngestionPage(page);
    await ingestion.goto();

    // THEN
    await expect(ingestion.recursiveCheckbox).toBeChecked();
  });

  /**
   * SCENARIO 5: Les formats pris en charge sont listés
   *
   *   GIVEN  la page d'ingestion est chargée
   *   WHEN   on regarde la section formats
   *   THEN   les formats PDF, DOCX, XLSX, PNG, JPG, etc. sont affichés
   */
  test('Given page chargée, When section formats, Then formats listés', async ({ page }) => {
    const ingestion = new IngestionPage(page);
    await ingestion.goto();

    // THEN
    await expect(ingestion.formatsSection).toBeVisible();
    await expect(page.getByText('.pdf')).toBeVisible();
    await expect(page.getByText('.docx')).toBeVisible();
    await expect(page.getByText('.png')).toBeVisible();
  });

  /**
   * SCENARIO 6: Erreur de validation si chemin vide et clic forcé
   *
   *   GIVEN  le champ chemin est vide
   *   WHEN   l'admin force le clic (via JS)
   *   THEN   un message d'erreur "Veuillez saisir un chemin" s'affiche
   */
  test('Given chemin vide, When submit forcé, Then erreur affichée', async ({ page }) => {
    const ingestion = new IngestionPage(page);
    await ingestion.goto();

    // WHEN — on tape un espace puis on efface pour activer le bouton
    await ingestion.fillDirectoryPath(' ');
    // Le bouton n'est pas disabled car trim() n'est pas appliqué au check disabled
    // Mais handleIngest vérifie trim()
    await ingestion.startIngestion();

    // THEN
    await ingestion.expectErrorMessage('chemin');
  });

  /**
   * SCENARIO 7: Sélection de catégorie parmi les options
   *
   *   GIVEN  la page d'ingestion est chargée
   *   WHEN   l'admin sélectionne "Facture / Bordereau"
   *   THEN   la catégorie est mise à jour
   */
  test('Given page chargée, When sélection catégorie, Then valeur mise à jour', async ({ page }) => {
    const ingestion = new IngestionPage(page);
    await ingestion.goto();

    // WHEN
    await ingestion.selectCategory('Facture');

    // THEN
    await expect(ingestion.categorySelect).toHaveValue('Facture');
  });

  /**
   * SCENARIO 8: Toggle de la checkbox récursive
   *
   *   GIVEN  la checkbox récursive est cochée
   *   WHEN   l'admin la décoche
   *   THEN   elle n'est plus cochée
   */
  test('Given recursive cochée, When décocher, Then non cochée', async ({ page }) => {
    const ingestion = new IngestionPage(page);
    await ingestion.goto();

    // GIVEN
    await expect(ingestion.recursiveCheckbox).toBeChecked();

    // WHEN
    await ingestion.toggleRecursive();

    // THEN
    await expect(ingestion.recursiveCheckbox).not.toBeChecked();
  });
});
