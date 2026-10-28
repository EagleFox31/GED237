import type { Page } from '@playwright/test';
import { test, expect } from '@playwright/test';
import { bootstrapTenantAdminSession } from '../utils/mockAuth';

const rootUnit = {
  id: '11111111-1111-1111-1111-111111111111',
  name: 'Direction des infrastructures',
  code: 'DIR-INFRA',
  level: 1,
  parent_id: null,
  children: [
    {
      id: '22222222-2222-2222-2222-222222222222',
      name: 'Service des marches',
      code: 'SRV-MARCHE',
      level: 2,
      parent_id: '11111111-1111-1111-1111-111111111111',
      children: [],
    },
  ],
};

const users = [
  { id: 'aaaa', org_unit_id: rootUnit.id, full_name: 'Agent Direction' },
  { id: 'bbbb', org_unit_id: '22222222-2222-2222-2222-222222222222', full_name: 'Agent Marches' },
];

const categories = [
  {
    id: '33333333-3333-3333-3333-333333333333',
    tenant_id: 'tenant-1',
    code: 'NOTE',
    name: 'Note de service',
    is_active: true,
    created_at: '2026-04-28T08:00:00Z',
    updated_at: '2026-04-28T08:00:00Z',
  },
];

const domains = [
  { id: '44444444-4444-4444-4444-444444444444', code: 'marches', name: 'Marches', is_active: true },
  { id: '55555555-5555-5555-5555-555555555555', code: 'budget', name: 'Budget', is_active: true },
];

const activities = [
  {
    id: '66666666-6666-6666-6666-666666666666',
    domain_id: '44444444-4444-4444-4444-444444444444',
    code: 'reparation',
    name: 'Reparation',
    is_active: true,
  },
  {
    id: '77777777-7777-7777-7777-777777777777',
    domain_id: '55555555-5555-5555-5555-555555555555',
    code: 'engagement',
    name: 'Engagement',
    is_active: true,
  },
];

const noteCategory = categories[0]!;
const marchesDomain = domains[0]!;
const budgetDomain = domains[1]!;
const reparationActivity = activities[0]!;
const engagementActivity = activities[1]!;

const documents = [
  {
    id: 'doc-1',
    title: 'Note reparation toiture',
    tenant_id: 'tenant-1',
    org_unit_id: rootUnit.id,
    owner_id: 'owner-1',
    file_path: 'docs/note-reparation.pdf',
    file_type: 'pdf',
    file_size: 2048,
    mime_type: 'application/pdf',
    document_category_id: noteCategory.id,
    category_code: noteCategory.code,
    category_name: noteCategory.name,
    tags: [],
    status: 'validated',
    processing_mode: 'archive',
    current_version_number: '1.0',
    current_version_id: 'version-1',
    created_at: '2026-04-28T08:00:00Z',
    updated_at: '2026-04-28T08:00:00Z',
    classification_domain_id: marchesDomain.id,
    classification_domain_name: marchesDomain.name,
    classification_activity_id: reparationActivity.id,
    classification_activity_name: reparationActivity.name,
    classification_year: 2026,
    classification_scope: 'service',
    classification_target_org_unit_id: '22222222-2222-2222-2222-222222222222',
    classification_target_user_id: null,
    classification_status: 'classified',
    logical_space_path: 'Direction des infrastructures / Marches / Reparation / 2026',
    source_relative_path: 'source/note-reparation.pdf',
    import_job_id: null,
  },
  {
    id: 'doc-2',
    title: 'Engagement budgétaire provisoire',
    tenant_id: 'tenant-1',
    org_unit_id: rootUnit.id,
    owner_id: 'owner-2',
    file_path: 'docs/engagement.pdf',
    file_type: 'pdf',
    file_size: 4096,
    mime_type: 'application/pdf',
    document_category_id: noteCategory.id,
    category_code: noteCategory.code,
    category_name: noteCategory.name,
    tags: [],
    status: 'draft',
    processing_mode: 'process',
    current_version_number: '1.0',
    current_version_id: 'version-2',
    created_at: '2026-04-27T08:00:00Z',
    updated_at: '2026-04-27T08:00:00Z',
    classification_domain_id: budgetDomain.id,
    classification_domain_name: budgetDomain.name,
    classification_activity_id: engagementActivity.id,
    classification_activity_name: engagementActivity.name,
    classification_year: 2025,
    classification_scope: 'service',
    classification_target_org_unit_id: rootUnit.id,
    classification_target_user_id: null,
    classification_status: 'needs_review',
    logical_space_path: null,
    source_relative_path: 'source/engagement.pdf',
    import_job_id: null,
  },
];

async function mockSpacesDependencies(page: Page) {
  await page.route('**/api/v1/spaces/tree**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([rootUnit]) });
  });
  await page.route('**/api/v1/spaces/documents**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(documents) });
  });
  await page.route('**/api/v1/users**', async (route) => {
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

test.describe('Feature: Espaces documentaires metier', () => {
  test.beforeEach(async ({ page }) => {
    await bootstrapTenantAdminSession(page);
    await mockSpacesDependencies(page);
  });

  test('Given classified documents, When user opens spaces, Then logical path and filters expose the business view', async ({ page }) => {
    await page.goto('spaces');

    await expect(page.getByRole('heading', { name: /explorateur documentaire/i })).toBeVisible();
    await expect(page.getByText('Direction des infrastructures / Marches / Reparation / 2026')).toBeVisible();
    await expect(page.getByText('Service des marches', { exact: true }).last()).toBeVisible();

    await page.getByLabel('Filtre domaine').selectOption(marchesDomain.id);

    await expect(page.getByText('Note reparation toiture')).toBeVisible();
    await expect(page.getByText('Engagement budgétaire provisoire')).toHaveCount(0);

    await page.getByLabel('Filtre statut de classement').selectOption('needs_review');
    await expect(page.getByText('Aucun document ne correspond a vos criteres.')).toBeVisible();
  });
});
