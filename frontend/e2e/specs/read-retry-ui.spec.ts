import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures/auth.fixture';

/**
 * « Lecture en échec » : pastille dans la liste et la fiche, bouton « Relancer la lecture », toast.
 * Réponses simulées (contrat : ocr_status = failed ; POST /documents/{id}/ocr/retry → 202, 409 si déjà en cours).
 * Interrupteur : E2E_READ_RETRY_REAL=1 → API réelle (cas simulés ignorés).
 */
const REAL_API = process.env.E2E_READ_RETRY_REAL === '1';
const TITLE = '[E2E] Lecture en échec';

// null = champ can_update absent de la réponse (undefined retomberait sur la valeur par défaut true).
const doc = (ocr_status: string, can_update: boolean | null = true) => ({
  id: '11111111-1111-4111-8111-111111111111',
  title: TITLE,
  tenant_id: '22222222-2222-4222-8222-222222222222',
  org_unit_id: null,
  owner_id: '33333333-3333-4333-8333-333333333333',
  file_path: 'x/y.pdf',
  file_type: 'pdf',
  file_size: 1024,
  mime_type: 'application/pdf',
  document_category_id: null,
  category_code: null,
  category_name: null,
  tags: [],
  status: 'draft',
  current_version_number: null,
  current_version_id: null,
  created_at: '2026-11-01T10:00:00Z',
  updated_at: '2026-11-01T10:00:00Z',
  ocr_status,
  ...(can_update === null ? {} : { can_update }),
});

async function mockDocuments(page: Page, ocrStatus: string, retryStatus: number, canUpdate: boolean | null = true): Promise<{ retries: number }> {
  const state = { retries: 0 };
  if (REAL_API) return state;
  await page.route(/\/api\/v1\/documents(\?.*)?$/, (route) =>
    route.request().method() === 'GET' ? route.fulfill({ status: 200, json: [doc(ocrStatus, canUpdate)] }) : route.fallback(),
  );
  await page.route(/\/documents\/[^/]+\/ocr\/retry$/, (route) => {
    state.retries += 1;
    return route.fulfill(retryStatus === 202 ? { status: 202, body: '' } : { status: retryStatus, json: { detail: 'busy' } });
  });
  return state;
}

test.describe('Feature: lecture en échec', () => {
  test.skip(REAL_API, 'cas simulés uniquement');

  test('Given une lecture en échec, When j\'ouvre la fiche et relance, Then toast et pastille « en cours »', async ({ loginAs, page }) => {
    const mock = await mockDocuments(page, 'failed', 202);
    await loginAs('tenant_admin');
    await page.goto('documents');

    const card = page.getByText(TITLE);
    await expect(card).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('read-state').first()).toHaveText('Lecture en échec');
    await card.click();
    await page.getByRole('button', { name: 'Relancer la lecture' }).click();

    await expect(page.getByText('Lecture relancée.')).toBeVisible();
    await expect(page.getByTestId('read-state').last()).toHaveText('Lecture en cours');
    await expect(page.getByRole('button', { name: 'Relancer la lecture' })).toHaveCount(0);
    expect(mock.retries).toBe(1);
  });

  test('Given un 409, When je relance, Then le message « déjà en cours » s\'affiche', async ({ loginAs, page }) => {
    await mockDocuments(page, 'failed', 409);
    await loginAs('tenant_admin');
    await page.goto('documents');

    await page.getByText(TITLE).click();
    await page.getByRole('button', { name: 'Relancer la lecture' }).click();
    await expect(page.getByText('Lecture déjà en cours, réessayez dans quelques minutes')).toBeVisible();
    // La pastille reste en échec : rien n'a été relancé.
    await expect(page.getByTestId('read-state').last()).toHaveText('Lecture en échec');
  });

  test('Given une lecture normale ou inconnue, Then pas de bouton ; inconnue = en cours', async ({ loginAs, page }) => {
    await mockDocuments(page, 'statut_inconnu', 202);
    await loginAs('tenant_admin');
    await page.goto('documents');

    await expect(page.getByText(TITLE)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('read-state').first()).toHaveText('Lecture en cours');
    await page.getByText(TITLE).click();
    await expect(page.getByRole('button', { name: 'Relancer la lecture' })).toHaveCount(0);
  });

  for (const [label, canUpdate] of [['absent', null], ['faux', false]] as const) {
    test(`Given can_update ${label}, When j'ouvre une lecture en échec, Then pas de bouton « Relancer la lecture »`, async ({ loginAs, page }) => {
      await mockDocuments(page, 'failed', 202, canUpdate);
      await loginAs('tenant_admin');
      await page.goto('documents');

      await page.getByText(TITLE).click();
      await expect(page.getByTestId('read-state').last()).toHaveText('Lecture en échec');
      await expect(page.getByRole('button', { name: 'Relancer la lecture' })).toHaveCount(0);
    });
  }
});
