import type { Page } from '@playwright/test';

import { test, expect, apiAs, type UatApi } from '../../fixtures/uat.fixture';

/**
 * Archivage (#228) : seuls les profils qui ont `documents archive` (tenant_admin, super_admin via
 * manage) voient « Archiver », et seulement sur un document validé ou signé (sinon l'API répond 409).
 * Le document validé est préparé par l'API : son auteur ouvre un circuit d'un visa, le valideur l'accepte.
 * Le Manager ne voit que les documents de son unité : son cas part d'un document de collaborateur.
 */
async function validatedDocument(owner: UatApi, validator: UatApi, runId: string, title: string) {
  const doc = await owner.uploadDocument(`archive-${runId}-${title.length}.txt`, title, `Archiver ${title}`);
  const [step] = await owner.submitForVisa(doc.id, (await validator.me()).id, 'Visa archivage');
  const { current_version_id: versionId } = await owner.getDocument(doc.id);
  if (!step || !versionId) throw new Error(`circuit ou version absent pour ${title}`);
  await validator.acceptVisa(step.id, versionId);
  await expect.poll(async () => (await owner.getDocument(doc.id)).status).toBe('validated');
  return doc;
}

const openDocument = async (page: Page, runId: string, title: string) => {
  await page.goto(`documents?q=${encodeURIComponent(runId)}`);
  await page.locator('.grid > div').filter({ hasText: title }).click();
};

test.describe('Archivage', () => {
  test.slow(); // circuit de visa + plusieurs connexions

  test('administrateur : archive un document validé', async ({ page, loginAs, request, adminApi, runId }) => {
    const title = `Archive validé ${runId}`;
    const doc = await validatedDocument(adminApi, await apiAs(request, 'manager'), runId, title);

    await loginAs('tenant_admin');
    await openDocument(page, runId, title);
    const archive = page.getByRole('button', { name: 'Archiver', exact: true });
    await archive.click();
    await page.getByRole('button', { name: 'Oui, archiver', exact: true }).click();

    // Pendant la requête le bouton affiche « Archivage… » : on attend l'état serveur, pas sa disparition.
    await expect.poll(async () => (await adminApi.getDocument(doc.id)).status).toBe('archived');
    await expect(archive).toHaveCount(0);
    await page.getByRole('button', { name: 'Fermer', exact: true }).click();
    await expect(page.locator('.grid > div').filter({ hasText: title }).getByText('Archivé')).toBeVisible();
  });

  test('administrateur : pas d’« Archiver » sur un brouillon', async ({ page, loginAs, adminApi, runId }) => {
    const title = `Archive brouillon ${runId}`;
    await adminApi.uploadDocument(`archive-brouillon-${runId}.txt`, title, `Brouillon ${runId}`);

    await loginAs('tenant_admin');
    await openDocument(page, runId, title);
    await expect(page.getByRole('button', { name: 'Fermer', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Archiver' })).toHaveCount(0);
  });

  test('Manager : pas d’« Archiver » (droit refusé par le serveur)', async ({ page, loginAs, request, runId }) => {
    const title = `Archive manager ${runId}`;
    // Le Manager voit les documents de son unité : un collaborateur de l'unité dépose, le Manager vise.
    const manager = await apiAs(request, 'manager');
    const doc = await validatedDocument(await apiAs(request, 'collaborator'), manager, runId, title);
    expect((await manager.tryArchive(doc.id)).status(), 'PATCH status=archived en Manager').toBe(403);

    await loginAs('manager');
    await openDocument(page, runId, title);
    await expect(page.getByRole('button', { name: 'Fermer', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Archiver' })).toHaveCount(0);
  });
});
