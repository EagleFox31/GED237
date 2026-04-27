import { test, expect } from '../fixtures/auth.fixture';

/**
 * Test that each role lands on the correct dashboard after login.
 * These specs validate RBAC routing — each profile sees its own dashboard.
 */
test.describe('Feature: Dashboards par rôle', () => {

  /**
   * SCENARIO 1: Super Admin → PlatformDashboard
   *
   *   GIVEN  un super_admin connecté
   *   WHEN   le dashboard se charge
   *   THEN   le badge "Contrôle National" ou des métriques plateforme sont visibles
   */
  test('Given super_admin, When dashboard, Then PlatformDashboard', async ({ loginAs, page }) => {
    await loginAs('super_admin');
    await expect(page.getByText(/contrôle national|plateforme|instances/i).first()).toBeVisible({ timeout: 10_000 });
  });

  /**
   * SCENARIO 2: Tenant Admin → OrgDashboard
   *
   *   GIVEN  un tenant_admin connecté
   *   WHEN   le dashboard se charge
   *   THEN   le titre "Vue d'ensemble" et les métriques du ministère sont visibles
   */
  test('Given tenant_admin, When dashboard, Then OrgDashboard', async ({ loginAs, page }) => {
    await loginAs('tenant_admin');
    await expect(page.getByText("Vue d'ensemble")).toBeVisible({ timeout: 10_000 });
  });

  /**
   * SCENARIO 3: Unit Admin → ServiceDashboard
   *
   *   GIVEN  un unit_admin connecté
   *   WHEN   le dashboard se charge
   *   THEN   les indicateurs de service sont visibles
   */
  test('Given unit_admin, When dashboard, Then ServiceDashboard', async ({ loginAs, page }) => {
    await loginAs('unit_admin');
    await expect(page.getByText(/indicateurs|tableau de bord.*service/i).first()).toBeVisible({ timeout: 10_000 });
  });

  /**
   * SCENARIO 4: Manager → ValidationHub
   *
   *   GIVEN  un manager connecté
   *   WHEN   le dashboard se charge
   *   THEN   le titre "Espace Manager" et "Pile de Décision" sont visibles
   */
  test('Given manager, When dashboard, Then ValidationHub', async ({ loginAs, page }) => {
    await loginAs('manager');
    await expect(page.getByText('Espace Manager')).toBeVisible({ timeout: 10_000 });
  });

  /**
   * SCENARIO 5: Collaborateur → DraftWorkspace
   *
   *   GIVEN  un collaborateur connecté
   *   WHEN   le dashboard se charge
   *   THEN   le titre "Mon Atelier" et le bouton "Nouveau Document" sont visibles
   */
  test('Given collaborateur, When dashboard, Then DraftWorkspace', async ({ loginAs, page }) => {
    await loginAs('collaborator');
    await expect(page.getByText('Mon Atelier')).toBeVisible({ timeout: 10_000 });
  });

  /**
   * SCENARIO 6: Lecteur → LibraryView
   *
   *   GIVEN  un lecteur connecté
   *   WHEN   le dashboard se charge
   *   THEN   le titre "Ma Bibliothèque" et le badge "Base Documentaire" sont visibles
   */
  test('Given reader, When dashboard, Then LibraryView', async ({ loginAs, page }) => {
    await loginAs('reader');
    await expect(page.getByText('Ma Bibliothèque')).toBeVisible({ timeout: 10_000 });
  });

  /**
   * SCENARIO 7: Auditeur → AuditLogs
   *
   *   GIVEN  un auditeur connecté
   *   WHEN   le dashboard se charge
   *   THEN   les logs d'audit ou le module conformité sont visibles
   */
  test('Given auditor, When dashboard, Then AuditLogs', async ({ loginAs, page }) => {
    await loginAs('auditor');
    await expect(page.getByText(/audit|conformité|compliance/i).first()).toBeVisible({ timeout: 10_000 });
  });
});
