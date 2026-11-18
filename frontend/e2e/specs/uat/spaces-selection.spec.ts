import type { Page } from '@playwright/test';

import { test, expect, apiAs } from '../../fixtures/uat.fixture';
import { validatedDocument } from '../../fixtures/validatedDocument';

// The explorer opens in the icons view: rows only exist in the details view.
const openDetailsView = async (page: Page, runId: string) => {
  await page.goto(`spaces?q=${encodeURIComponent(runId)}`);
  await page.getByRole('button', { name: /Détails$/ }).click();
};

test.describe('Explorateur — sélection multiple (#150)', () => {
  test('Ctrl+clic, Maj+clic, Ctrl+A sélectionnent plusieurs documents ; rien d archivable, pas d « Archiver »', async ({
    page,
    loginAs,
    adminApi,
    runId,
  }) => {
    const t1 = `Sel-1-${runId}`;
    const t2 = `Sel-2-${runId}`;
    const t3 = `Sel-3-${runId}`;
    await adminApi.uploadDocument(`sel1-${runId}.txt`, t1, `A ${runId}`);
    await adminApi.uploadDocument(`sel2-${runId}.txt`, t2, `B ${runId}`);
    await adminApi.uploadDocument(`sel3-${runId}.txt`, t3, `C ${runId}`);

    await loginAs('tenant_admin');
    await openDetailsView(page, runId);

    const r1 = page.getByRole('row', { name: new RegExp(t1) });
    const r2 = page.getByRole('row', { name: new RegExp(t2) });
    const r3 = page.getByRole('row', { name: new RegExp(t3) });
    await expect(r1).toBeVisible();
    await expect(r2).toBeVisible();
    await expect(r3).toBeVisible();

    await r1.click();
    await expect(page.getByText('1 sélectionné')).toBeVisible();

    await r3.click({ modifiers: ['Shift'] });
    await expect(page.getByText('3 sélectionnés')).toBeVisible();

    await r2.click({ modifiers: ['Control'] });
    await expect(page.getByText('2 sélectionnés')).toBeVisible();

    await r1.focus();
    await page.keyboard.press('Control+a');
    await expect(page.getByText('3 sélectionnés')).toBeVisible();

    // Drafts only: the profile may archive, but none of these documents can be.
    await expect(page.getByRole('button', { name: 'Télécharger la sélection' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Archiver la sélection' })).toHaveCount(0);
  });

  test('administrateur : archivage groupé confirmé, un seul bilan avec les documents écartés', async ({
    page,
    loginAs,
    request,
    adminApi,
    runId,
  }) => {
    test.slow(); // visa circuit + login
    const validated = `Sel-valide-${runId}`;
    const draft = `Sel-brouillon-${runId}`;
    const doc = await validatedDocument(adminApi, await apiAs(request, 'manager'), runId, validated);
    await adminApi.uploadDocument(`sel-draft-${runId}.txt`, draft, `D ${runId}`);

    await loginAs('tenant_admin');
    await openDetailsView(page, runId);
    const row = page.getByRole('row', { name: new RegExp(draft) });
    await expect(row).toBeVisible();
    await expect(page.getByRole('row', { name: new RegExp(validated) })).toBeVisible();
    await row.focus();
    await page.keyboard.press('Control+a');
    await expect(page.getByText('2 sélectionnés')).toBeVisible();

    // Archiving asks first, with the count.
    await page.getByRole('button', { name: 'Archiver la sélection' }).click();
    await expect(page.getByText('Archiver 2 documents ?')).toBeVisible();
    await page.getByRole('button', { name: 'Oui, archiver' }).click();

    // One summary, in plain French: the draft is skipped with its status as the reason.
    const summary = page.getByTestId('explorer-bulk-summary');
    await expect(summary).toContainText('1 archivé');
    await expect(summary).toContainText(`1 impossible : ${draft} (brouillon)`);
    await expect.poll(async () => (await adminApi.getDocument(doc.id)).status).toBe('archived');
  });

  test('Manager : sélection possible, pas d « Archiver la sélection » (droit refusé par le serveur)', async ({
    page,
    loginAs,
    request,
    runId,
  }) => {
    test.slow(); // visa circuit + login
    // The Manager sees the unit's documents: a collaborator of the unit uploads, the Manager validates.
    const title = `Sel-manager-${runId}`;
    await validatedDocument(await apiAs(request, 'collaborator'), await apiAs(request, 'manager'), runId, title);

    await loginAs('manager');
    await openDetailsView(page, runId);
    const row = page.getByRole('row', { name: new RegExp(title) });
    await expect(row).toBeVisible();
    await row.click();
    await expect(page.getByText('1 sélectionné')).toBeVisible();

    await expect(page.getByRole('button', { name: 'Télécharger la sélection' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Archiver la sélection' })).toHaveCount(0);
  });
});
