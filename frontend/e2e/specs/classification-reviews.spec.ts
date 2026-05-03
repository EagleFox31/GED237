import type { Page } from '@playwright/test';
import { test, expect } from '@playwright/test';
import { bootstrapTenantAdminSession } from '../utils/mockAuth';

const review = {
  id: '11111111-1111-1111-1111-111111111111',
  tenant_id: 'tenant-1',
  document_id: 'doc-1',
  review_status: 'open',
  arbitration_reason: 'Plusieurs règles de même priorité correspondent.',
  suggested_domain_id: 'domain-1',
  suggested_activity_id: 'activity-1',
  suggested_year: 2026,
  suggested_scope: 'service',
  suggested_target_org_unit_id: 'org-1',
  suggested_target_user_id: null,
  resolved_by_id: null,
  resolved_at: null,
  resolution_comment: null,
  created_at: '2026-04-29T08:00:00Z',
  updated_at: '2026-04-29T08:00:00Z',
  document: {
    id: 'doc-1',
    title: 'Bon de commande ambigu',
    tenant_id: 'tenant-1',
    org_unit_id: 'org-1',
    owner_id: 'user-1',
    file_path: 'tenant/org/doc.pdf',
    file_type: 'pdf',
    file_size: 1024,
    mime_type: 'application/pdf',
    document_category_id: 'cat-1',
    category_code: 'NOTE',
    category_name: 'Note de service',
    tags: [],
    status: 'draft',
    processing_mode: 'process',
    current_version_number: '1.0',
    current_version_id: 'version-1',
    created_at: '2026-04-29T08:00:00Z',
    updated_at: '2026-04-29T08:00:00Z',
    classification_domain_id: null,
    classification_domain_name: null,
    classification_activity_id: null,
    classification_activity_name: null,
    classification_year: null,
    classification_scope: 'service',
    classification_target_org_unit_id: null,
    classification_target_user_id: null,
    classification_status: 'needs_review',
    logical_space_path: null,
    source_relative_path: 'source/doc.pdf',
    import_job_id: null,
  },
};

const auditLogs = [
  {
    id: 'audit-1',
    tenant_id: 'tenant-1',
    user_id: 'user-1',
    table_name: 'documents',
    record_id: 'doc-1',
    action: 'needs_review',
    old_data: null,
    new_data: { reason: 'Ambiguïté détectée' },
    ip_address: null,
    user_agent: null,
    created_at: '2026-04-29T08:01:00Z',
  },
];

const orgUnits = [{ id: 'org-1', name: 'Direction des marchés' }];
const users = [{ id: 'user-1', full_name: 'Agent Marchés', org_unit_id: 'org-1', role_label: 'Collaborateur' }];
const categories = [{ id: 'cat-1', tenant_id: 'tenant-1', code: 'NOTE', name: 'Note de service', is_active: true, created_at: '2026-04-29T08:00:00Z', updated_at: '2026-04-29T08:00:00Z' }];
const domains = [{ id: 'domain-1', name: 'Marchés', is_active: true }];
const activities = [{ id: 'activity-1', domain_id: 'domain-1', name: 'Réparation', is_active: true }];

async function mockReviewDependencies(page: Page) {
  await page.route('**/api/v1/classification-reviews', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([review]) });
      return;
    }
    await route.continue();
  });
  await page.route('**/api/v1/classification-reviews/*/resolve', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        review_id: review.id,
        document_id: review.document_id,
        review_status: 'resolved',
        document_classification_status: 'classified',
        logical_space_path: 'Direction des marchés / Marchés / Réparation / 2026',
        workflow_relaunched: true,
        document: review.document,
      }),
    });
  });
  await page.route('**/api/v1/documents/doc-1/audit-logs', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(auditLogs) });
  });
  await page.route('**/api/v1/org-units', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(orgUnits) });
  });
  await page.route('**/api/v1/users', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(users) });
  });
  await page.route('**/api/v1/categories**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(categories) });
  });
  await page.route('**/api/v1/classification-rules/domains**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(domains) });
  });
  await page.route('**/api/v1/classification-rules/activities**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(activities) });
  });
}

test.describe('Feature: Revue de classement', () => {
  test.beforeEach(async ({ page }) => {
    await bootstrapTenantAdminSession(page);
    await mockReviewDependencies(page);
  });

  test('Given an open classification review, When the admin resolves it, Then the workflow relaunch path is exposed', async ({ page }) => {
    await page.goto('classification-reviews');

    await expect(page.getByRole('heading', { name: /revue de classement/i })).toBeVisible();
    await expect(page.getByText(/plusieurs règles de même priorité/i).first()).toBeVisible();

    await page.getByLabel('Domaine').selectOption('domain-1');
    await page.getByLabel('Activité').selectOption('activity-1');
    await page.getByLabel('Année').fill('2026');
    await page.getByLabel('Commentaire de résolution').fill('Classement validé après arbitrage.');

    const responsePromise = page.waitForResponse(
      (response) => /\/classification-reviews\/[^/]+\/resolve/.test(response.url()) && response.request().method() === 'POST'
    );
    await page.getByRole('button', { name: /classer et relancer/i }).click();
    const response = await responsePromise;
    expect(response.ok()).toBeTruthy();
    await expect(page.getByText(/workflow relancé/i)).toBeVisible();
  });
});
