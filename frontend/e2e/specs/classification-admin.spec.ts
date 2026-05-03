import { test, expect } from '@playwright/test';
import { bootstrapTenantAdminSession } from '../utils/mockAuth';

test.describe('Feature: Administration du classement documentaire', () => {
  test.beforeEach(async ({ page }) => {
    await bootstrapTenantAdminSession(page);

    const domains = [
      {
        id: 'domain-1',
        tenant_id: 'tenant-1',
        code: 'marches',
        name: 'Marchés',
        description: 'Gestion des marchés publics',
        is_active: true,
        created_at: '2026-04-29T08:00:00Z',
        updated_at: '2026-04-29T08:00:00Z',
      },
    ];
    const activities = [
      {
        id: 'activity-1',
        tenant_id: 'tenant-1',
        domain_id: 'domain-1',
        domain_name: 'Marchés',
        code: 'reparation',
        name: 'Réparation',
        description: 'Travaux et réhabilitations',
        is_active: true,
        created_at: '2026-04-29T08:00:00Z',
        updated_at: '2026-04-29T08:00:00Z',
      },
    ];
    const rules = [
      {
        id: 'rule-1',
        tenant_id: 'tenant-1',
        code: 'route_marche',
        name: 'Classement marchés',
        description: 'Règle principale marchés',
        priority: 10,
        is_active: true,
        source_scope: 'service',
        source_org_unit_id: 'org-1',
        source_org_unit_name: 'Direction des marchés',
        source_user_id: null,
        source_user_name: null,
        document_category_id: 'cat-1',
        document_category_name: 'Note de service',
        filename_pattern: 'marche',
        mime_type_pattern: 'application/pdf',
        target_scope: 'service',
        target_org_unit_id: 'org-1',
        target_org_unit_name: 'Direction des marchés',
        target_user_id: null,
        target_user_name: null,
        domain_id: 'domain-1',
        domain_name: 'Marchés',
        activity_id: 'activity-1',
        activity_name: 'Réparation',
        year_strategy: 'current',
        fixed_year: null,
        workflow_template_id: 'tpl-1',
        workflow_template_name: 'Visa standard',
        created_at: '2026-04-29T08:00:00Z',
        updated_at: '2026-04-29T08:00:00Z',
      },
    ];

    await page.route('**/api/v1/categories**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'cat-1',
            tenant_id: 'tenant-1',
            code: 'NOTE',
            name: 'Note de service',
            is_active: true,
            created_at: '2026-04-29T08:00:00Z',
            updated_at: '2026-04-29T08:00:00Z',
          },
        ]),
      });
    });
    await page.route('**/api/v1/org-units', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 'org-1', name: 'Direction des marchés' }]),
      });
    });
    await page.route('**/api/v1/users', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 'user-1', full_name: 'Agent Marchés', org_unit_id: 'org-1', role_label: 'Collaborateur' }]),
      });
    });
    await page.route('**/api/v1/gedrules/templates', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 'tpl-1', name: 'Visa standard', is_active: true }]),
      });
    });
    await page.route('**/api/v1/classification-rules/domains**', async (route) => {
      if (route.request().method() === 'POST') {
        const payload = route.request().postDataJSON() as { code: string; name: string; description?: string | null };
        const created = {
          id: `domain-${domains.length + 1}`,
          tenant_id: 'tenant-1',
          code: payload.code,
          name: payload.name,
          description: payload.description || '',
          is_active: true,
          created_at: '2026-04-29T08:05:00Z',
          updated_at: '2026-04-29T08:05:00Z',
        };
        domains.push(created);
        await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(created) });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(domains) });
    });
    await page.route('**/api/v1/classification-rules/activities**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(activities) });
    });
    await page.route('**/api/v1/classification-rules/rules', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rules) });
    });
    await page.route('**/api/v1/classification-rules/simulate', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'classified',
          rule_id: 'rule-1',
          rule_code: 'route_marche',
          rule_name: 'Classement marchés',
          rule_priority: 10,
          message: 'Règle appliquée avec succès.',
          logical_space_path: 'Direction des marchés / Marchés / Réparation / 2026',
          classification_scope: 'service',
          classification_target_org_unit_id: 'org-1',
          classification_target_org_unit_name: 'Direction des marchés',
          classification_target_user_id: null,
          classification_target_user_name: null,
          classification_domain_id: 'domain-1',
          classification_domain_name: 'Marchés',
          classification_activity_id: 'activity-1',
          classification_activity_name: 'Réparation',
          classification_year: 2026,
        }),
      });
    });
  });

  test('Given classification admin tab, When creating a domain, Then the new domain is visible', async ({ page }) => {
    await page.goto('rules');

    await page.getByRole('button', { name: /classement documentaire/i }).click();
    await expect(page.getByText(/administration du classement documentaire/i)).toBeVisible();
    await expect(page.getByText('Marchés', { exact: true }).first()).toBeVisible();

    await page.getByLabel('Nom domaine').fill('Budget');
    await page.getByLabel('Code domaine').fill('budget');

    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/classification-rules/domains') &&
        response.request().method() === 'POST',
    );

    await page.getByRole('button', { name: /créer le domaine/i }).click();

    const response = await responsePromise;
    expect(response.ok()).toBeTruthy();
    await expect(page.getByText('Budget', { exact: true }).first()).toBeVisible();
  });

  test('Given simulator tab, When running a simulation, Then the logical path is shown', async ({ page }) => {
    await page.goto('rules');

    await page.getByRole('button', { name: /classement documentaire/i }).click();
    await page.locator('button').filter({ hasText: /simulat/i }).last().click();

    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/classification-rules/simulate') &&
        response.request().method() === 'POST',
    );

    await page.getByRole('button', { name: /lancer la simulation/i }).click();
    const response = await responsePromise;
    expect(response.ok()).toBeTruthy();

    await expect(page.getByText('Direction des marchés / Marchés / Réparation / 2026')).toBeVisible();
    await expect(page.getByText(/classement marchés/i)).toBeVisible();
  });
});
