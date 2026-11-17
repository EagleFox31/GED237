import type { APIRequestContext } from '@playwright/test';

import { test, expect, API_URL } from '../../fixtures/uat.fixture';

/**
 * #151 : Suppr met à la corbeille, glisser-déposer reclasse ; « Annuler » reste 10 s, Ctrl+Z annule la dernière action.
 * Seed : MINFI001 (tenant_admin) ouvre l'explorateur sur le Cabinet du Ministre, dont la DAF est un sous-dossier.
 */
type Doc = { id: string; deleted_at?: string | null; classification_target_org_unit_id: string | null; org_unit_id: string | null };

async function getDoc(request: APIRequestContext, token: string, id: string) {
  const res = await request.get(`${API_URL}/documents/${id}`, { headers: { Authorization: `Bearer ${token}` } });
  return { status: res.status(), body: res.ok() ? ((await res.json()) as Doc) : null };
}

test.describe('Annuler la dernière action dans l’explorateur', () => {
  test('Suppr met à la corbeille, « Annuler » restaure', async ({ page, loginAs, adminApi, runId }) => {
    const title = `Suppr annulé ${runId}`;
    await adminApi.uploadDocument(`suppr-${runId}.txt`, title, `Suppr ${runId}`);

    await loginAs('tenant_admin');
    await page.goto(`spaces?q=${encodeURIComponent(runId)}`);
    const item = page.getByLabel(new RegExp(`^${title} — `));
    await item.focus();
    await page.keyboard.press('Delete');
    await expect(item).toHaveCount(0);

    const toast = page.getByRole('status').filter({ hasText: 'mis à la corbeille' });
    await toast.getByRole('button', { name: 'Annuler' }).click();
    await expect(item).toBeVisible();
    await expect(toast).toHaveCount(0);
  });

  test('Ctrl+Z annule la dernière mise à la corbeille', async ({ page, loginAs, adminApi, runId }) => {
    const title = `CtrlZ ${runId}`;
    await adminApi.uploadDocument(`ctrlz-${runId}.txt`, title, `CtrlZ ${runId}`);

    await loginAs('tenant_admin');
    await page.goto(`spaces?q=${encodeURIComponent(runId)}`);
    const item = page.getByLabel(new RegExp(`^${title} — `));
    await item.focus();
    await page.keyboard.press('Delete');
    await expect(page.getByRole('button', { name: 'Annuler' })).toBeVisible();

    await page.keyboard.press('Control+z');
    await expect(item).toBeVisible();
  });

  test('glisser vers un dossier reclasse ; « Annuler » rend l’emplacement d’origine', async ({
    page,
    loginAs,
    adminApi,
    request,
    adminToken,
    runId,
  }) => {
    const title = `Glissé ${runId}`;
    const uploaded = await adminApi.uploadDocument(`glisse-${runId}.txt`, title, `Glisser ${runId}`);
    const rootUnit = uploaded.org_unit_id!;
    // Unité cible déjà connue : condition pour proposer « Annuler » (contrat serveur #151).
    const patched = await request.patch(`${API_URL}/documents/${uploaded.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { classification_target_org_unit_id: rootUnit, classification_scope: 'service' },
    });
    expect(patched.ok(), 'PATCH emplacement initial').toBeTruthy();

    await loginAs('tenant_admin');
    await page.goto('spaces');
    const item = page.getByLabel(new RegExp(`^${title} — `));
    const folder = page.getByRole('button', { name: /Direction des Affaires Financieres/ }).first();
    await item.dragTo(folder);

    const toast = page.getByRole('status').filter({ hasText: 'déplacé vers' });
    await expect(toast).toBeVisible();
    await expect(item).toHaveCount(0);
    const moved = await getDoc(request, adminToken, uploaded.id);
    expect(moved.body?.classification_target_org_unit_id).not.toBe(rootUnit);

    await toast.getByRole('button', { name: 'Annuler' }).click();
    await expect(item).toBeVisible();
    const back = await getDoc(request, adminToken, uploaded.id);
    expect(back.body?.classification_target_org_unit_id).toBe(rootUnit);
  });

  test('sans unité cible d’origine : déplacé, mais pas de bouton « Annuler »', async ({
    page,
    loginAs,
    adminApi,
    request,
    adminToken,
    runId,
  }) => {
    const title = `Sans unité ${runId}`;
    const uploaded = await adminApi.uploadDocument(`sans-unite-${runId}.txt`, title, `Sans ${runId}`);
    const before = await getDoc(request, adminToken, uploaded.id);
    expect(before.body?.classification_target_org_unit_id ?? null).toBeNull();

    await loginAs('tenant_admin');
    await page.goto('spaces');
    await page
      .getByLabel(new RegExp(`^${title} — `))
      .dragTo(page.getByRole('button', { name: /Direction des Affaires Financieres/ }).first());

    const toast = page.getByRole('status').filter({ hasText: 'déplacé vers' });
    await expect(toast).toBeVisible();
    await expect(toast.getByRole('button', { name: 'Annuler' })).toHaveCount(0);
    const after = await getDoc(request, adminToken, uploaded.id);
    expect(after.body?.classification_target_org_unit_id).toBeTruthy();
  });
});
