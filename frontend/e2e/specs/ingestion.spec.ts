import type { Page } from '@playwright/test';
import { test, expect } from '@playwright/test';
import { IngestionPage } from '../pages/ingestion.page';
import { bootstrapTenantAdminSession } from '../utils/mockAuth';

const category = {
  id: '11111111-1111-1111-1111-111111111111',
  tenant_id: '22222222-2222-2222-2222-222222222222',
  code: 'NOTE',
  name: 'Note de service',
  is_active: true,
  created_at: '2026-04-28T08:00:00Z',
  updated_at: '2026-04-28T08:00:00Z',
};

const orgUnit = {
  id: '33333333-3333-3333-3333-333333333333',
  name: 'Direction des systemes',
};

const user = {
  id: '44444444-4444-4444-4444-444444444444',
  full_name: 'Agent Test',
  role_label: 'Collaborateur',
  org_unit_id: orgUnit.id,
  is_active: true,
};

const workflowTemplate = {
  id: '55555555-5555-5555-5555-555555555555',
  name: 'Circuit standard',
};

const analyzedJob = {
  id: '66666666-6666-6666-6666-666666666666',
  tenant_id: category.tenant_id,
  created_by_id: user.id,
  source_scope: 'service',
  target_org_unit_id: orgUnit.id,
  target_user_id: null,
  default_document_category_id: category.id,
  forced_year: 2026,
  processing_mode: 'archive',
  status: 'analyzed',
  total_files: 2,
  supported_files: 2,
  ignored_files: 0,
  duplicate_files: 0,
  error_files: 0,
  created_at: '2026-04-28T08:00:00Z',
  updated_at: '2026-04-28T08:00:00Z',
  items: [
    {
      id: '77777777-7777-7777-7777-777777777777',
      import_job_id: '66666666-6666-6666-6666-666666666666',
      original_filename: 'note-reparation.txt',
      source_relative_path: 'source/note-reparation.txt',
      mime_type: 'text/plain',
      file_size: 128,
      checksum_sha256: 'abc',
      detected_document_category_id: category.id,
      resolved_domain_id: '88888888-8888-8888-8888-888888888888',
      resolved_activity_id: '99999999-9999-9999-9999-999999999999',
      resolved_year: 2026,
      resolved_scope: 'service',
      resolved_target_org_unit_id: orgUnit.id,
      resolved_target_user_id: null,
      workflow_template_id: workflowTemplate.id,
      logical_space_path: 'Direction des systemes / Marches / Reparation / 2026',
      status: 'classified',
      error_message: null,
      document_id: null,
      created_at: '2026-04-28T08:00:00Z',
      updated_at: '2026-04-28T08:00:00Z',
    },
    {
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      import_job_id: '66666666-6666-6666-6666-666666666666',
      original_filename: 'doublon.txt',
      source_relative_path: 'source/doublon.txt',
      mime_type: 'text/plain',
      file_size: 64,
      checksum_sha256: 'def',
      detected_document_category_id: category.id,
      resolved_domain_id: null,
      resolved_activity_id: null,
      resolved_year: null,
      resolved_scope: null,
      resolved_target_org_unit_id: null,
      resolved_target_user_id: null,
      workflow_template_id: null,
      logical_space_path: null,
      status: 'duplicate',
      error_message: 'Un fichier identique existe deja dans ce tenant.',
      document_id: null,
      created_at: '2026-04-28T08:00:00Z',
      updated_at: '2026-04-28T08:00:00Z',
    },
  ],
};

const committedJob = {
  ...analyzedJob,
  status: 'completed_with_errors',
  duplicate_files: 1,
  error_files: 1,
  items: [
    {
      ...analyzedJob.items[0],
      status: 'imported',
      document_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    },
    analyzedJob.items[1],
  ],
};

async function mockIngestionDependencies(page: Page) {
  await page.route('**/api/v1/categories**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([category]) });
  });
  await page.route('**/api/v1/org-units**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([orgUnit]) });
  });
  await page.route('**/api/v1/users**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([user]) });
  });
  await page.route('**/api/v1/gedrules/templates**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([workflowTemplate]) });
  });
}

test.describe('Feature: Import batch en 2 temps', () => {
  test.beforeEach(async ({ page }) => {
    await bootstrapTenantAdminSession(page);
    await mockIngestionDependencies(page);
  });

  test('Given tenant_admin, When acces /ingestion, Then page Sprint 4 visible et analyse inactive sans fichier', async ({ page }) => {
    const ingestion = new IngestionPage(page);

    await ingestion.goto();

    await ingestion.expectPageVisible();
    await expect(ingestion.recursiveCheckbox).toBeChecked();
    await expect(ingestion.formatsSection).toBeVisible();
    await expect(page.getByText('.pdf')).toBeVisible();
    await expect(page.getByText('.docx')).toBeVisible();
    await ingestion.expectAnalyzeDisabled();
    await ingestion.expectCommitDisabled();
  });

  test('Given fichiers selectionnes, When analyse puis commit, Then preview puis resultat final visibles', async ({ page }) => {
    const ingestion = new IngestionPage(page);

    await page.route('**/api/v1/imports/analyze', async (route) => {
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(analyzedJob) });
    });
    await page.route('**/api/v1/imports/66666666-6666-6666-6666-666666666666/commit', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          job: committedJob,
          imported_documents: 1,
          pending_review_items: 1,
          failed_items: 0,
        }),
      });
    });

    await ingestion.goto();
    await ingestion.uploadFiles([
      {
        name: 'note-reparation.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('note'),
      },
      {
        name: 'doublon.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('duplicate'),
      },
    ]);

    await ingestion.expectAnalyzeEnabled();
    await ingestion.clickAnalyze();

    await expect(ingestion.previewTable).toBeVisible();
    await expect(page.getByText('source/note-reparation.txt')).toBeVisible();
    await expect(page.getByText('source/doublon.txt')).toBeVisible();
    await expect(page.getByText('Direction des systemes / Marches / Reparation / 2026')).toBeVisible();
    await expect(page.getByText('Circuit standard')).toBeVisible();
    await ingestion.expectCommitEnabled();

    await ingestion.clickCommit();

    await expect(ingestion.importedSection).toBeVisible();
    await expect(page.getByText('Documents importes (1)')).toBeVisible();
    await expect(page.getByText('Points de vigilance')).toBeVisible();
    await expect(page.getByText('Un fichier identique existe deja dans ce tenant.').first()).toBeVisible();
  });
});
