import type { APIRequestContext, Locator, Page } from '@playwright/test';
import { test, expect, API_URL, type UatApi } from '../../fixtures/uat.fixture';

/**
 * Post-rc1 L4 (#151, server side #179, explorer #184): "Annuler" after Suppr or after a drag-and-drop move.
 * - Suppr = POST /documents/{id}/trash; Annuler = POST /documents/{id}/restore.
 *   (Plain DELETE is the hard delete on main until #152 turns it into a move to the trash.)
 * - Move = PATCH /documents/{id} with a new classification; Annuler = the same PATCH with the 7 previous
 *   classification fields. Each move is audited as "reclassify" with before/after.
 * - Explorer: toast role=status, « Annuler » for 10 s, Ctrl+Z while the toast shows.
 * Each test creates its own domains and documents (runId), so the spec replays on any database.
 */
const CLASSIFICATION = [
  'classification_domain_id',
  'classification_activity_id',
  'classification_year',
  'classification_scope',
  'classification_target_org_unit_id',
  'classification_target_user_id',
  'classification_status',
] as const;
const PLACEMENT = [...CLASSIFICATION, 'logical_space_path', 'org_unit_id'] as const;
type Doc = Record<string, unknown> & { id: string };
type AuditEntry = { record_id: string; created_at: string; new_data: { before: Doc; after: Doc } };

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const pick = (doc: Doc, keys: readonly string[]) => Object.fromEntries(keys.map((k) => [k, doc[k] ?? null]));

async function patch(request: APIRequestContext, token: string, id: string, data: object): Promise<Doc> {
  const res = await request.patch(`${API_URL}/documents/${id}`, { headers: auth(token), data });
  expect(res.status(), await res.text()).toBe(200);
  return (await res.json()) as Doc;
}

async function getDoc(request: APIRequestContext, token: string, id: string): Promise<Doc> {
  const res = await request.get(`${API_URL}/documents/${id}`, { headers: auth(token) });
  expect(res.status(), await res.text()).toBe(200);
  return (await res.json()) as Doc;
}

async function trashIds(request: APIRequestContext, token: string): Promise<string[]> {
  const res = await request.get(`${API_URL}/documents/trash`, { headers: auth(token) });
  expect(res.status(), await res.text()).toBe(200);
  return ((await res.json()) as Doc[]).map((d) => d.id);
}

/** The "reclassify" audit entries of one document, oldest first. */
async function reclassifyLog(request: APIRequestContext, token: string, id: string): Promise<AuditEntry[]> {
  const res = await request.get(`${API_URL}/audit/logs`, {
    headers: auth(token),
    params: { action: 'reclassify', table_name: 'documents', limit: '500' },
  });
  expect(res.status(), await res.text()).toBe(200);
  return ((await res.json()) as AuditEntry[])
    .filter((l) => l.record_id === id)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

/** The last two entries must be a move and its exact inverse. */
function expectInverse(entries: AuditEntry[]) {
  const [move, back] = entries.slice(-2);
  if (!move || !back) throw new Error('entrées reclassify manquantes');
  expect(back.new_data.before).toEqual(move.new_data.after);
  expect(back.new_data.after).toEqual(move.new_data.before);
}

test.describe('Annuler une suppression ou un déplacement (API, #179)', () => {
  test('Suppr puis Annuler : le document revient à la même place', async ({ request, adminApi, adminToken, runId }) => {
    const doc = await adminApi.uploadDocument(`undo-del-${runId}.txt`, `Undo del ${runId}`, `Contenu ${runId}`);
    const before = pick(await getDoc(request, adminToken, doc.id), PLACEMENT);

    expect((await request.post(`${API_URL}/documents/${doc.id}/trash`, { headers: auth(adminToken) })).status()).toBe(200);
    expect((await request.post(`${API_URL}/documents/${doc.id}/restore`, { headers: auth(adminToken) })).status()).toBe(200);
    expect(pick(await getDoc(request, adminToken, doc.id), PLACEMENT)).toEqual(before);
  });

  test('glisser puis Annuler : ancienne classification rétablie, deux « reclassify » inverses', async ({
    request,
    adminApi,
    adminToken,
    runId,
  }) => {
    const units = ((await (await request.get(`${API_URL}/org-units/`, { headers: auth(adminToken) })).json()) as {
      id: string;
      is_active: boolean;
    }[]).filter((u) => u.is_active);
    const [unitA, unitB] = units;
    if (!unitA || !unitB) throw new Error('au moins deux unités actives attendues (seed)');
    const place = async (code: string, unitId: string, year: number) => {
      const domain = await adminApi.createDomain(`${code}-${runId}`, `Domaine ${code} ${runId}`);
      const activity = await adminApi.createActivity(domain.id, `${code}-act-${runId}`, `Activité ${code} ${runId}`);
      return {
        classification_domain_id: domain.id,
        classification_activity_id: activity.id,
        classification_year: year,
        classification_scope: 'service',
        classification_target_org_unit_id: unitId,
        classification_target_user_id: null,
        classification_status: 'classified',
      };
    };
    const home = await place('undo-a', unitA.id, 2026);
    const elsewhere = await place('undo-b', unitB.id, 2025);
    const doc = await adminApi.uploadDocument(`undo-mv-${runId}.txt`, `Undo move ${runId}`, `Contenu ${runId}`);

    const filed = pick(await patch(request, adminToken, doc.id, home), PLACEMENT);
    const moved = await patch(request, adminToken, doc.id, elsewhere);
    expect(moved.org_unit_id).toBe(unitB.id);
    expect(moved.logical_space_path).not.toBe(filed.logical_space_path);

    // Annuler = the same PATCH with the classification kept before the drag.
    const undone = await patch(request, adminToken, doc.id, pick(filed as Doc, CLASSIFICATION));
    expect(pick(undone, PLACEMENT)).toEqual(filed);

    const mine = await reclassifyLog(request, adminToken, doc.id);
    expect(mine).toHaveLength(3); // filing, move, undo
    expectInverse(mine);
  });
});

// UI part of #151 (explorer, #184). Seed: tenant_admin opens the explorer on its own unit; the DAF is a sub-folder.
const DAF = /Direction des Affaires Financieres/;
const itemOf = (page: Page, title: string) => page.getByLabel(new RegExp(`^${title} — `));
const toastFor = (page: Page, text: string) => page.getByRole('status').filter({ hasText: text });

/**
 * HTML5 drag onto the DAF folder. Right after a grid reload, Chromium sometimes ignores a mouse-driven drag:
 * mousedown lands on the connected, draggable card but no dragstart follows (traced on #184, 6 runs of 10).
 * So the gesture checks that the drag really started near the source, and starts over otherwise: no drag
 * means no drop and no PATCH, so a retry cannot move the document twice.
 */
async function dragToDaf(page: Page, source: Locator): Promise<void> {
  const target = page.getByRole('button', { name: DAF }).first();
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await expect(source).toBeVisible();
    await page.evaluate(() => {
      const w = window as unknown as { __gedDragStarted?: boolean };
      w.__gedDragStarted = false;
      window.addEventListener('dragstart', () => (w.__gedDragStarted = true), { once: true, capture: true });
    });
    await source.hover();
    const box = await source.boundingBox();
    if (!box) continue;
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 12, box.y + box.height / 2 + 6, { steps: 3 });
    const started = await page.evaluate(() => (window as unknown as { __gedDragStarted?: boolean }).__gedDragStarted);
    if (started) {
      await target.hover();
      await target.hover();
      await page.mouse.up();
      return;
    }
    await page.mouse.up();
  }
  throw new Error('le glisser n’a jamais démarré après 3 essais');
}

/** Upload, then file the document at service level in its own unit: the condition for « Annuler » after a drag. */
async function filedDoc(request: APIRequestContext, token: string, adminApi: UatApi, title: string, extra: object = {}) {
  const uploaded = await adminApi.uploadDocument(`${title}.txt`, title, `Contenu ${title}`);
  const unit = uploaded.org_unit_id;
  if (!unit) throw new Error('document déposé sans unité');
  await patch(request, token, uploaded.id, {
    classification_target_org_unit_id: unit,
    classification_scope: 'service',
    ...extra,
  });
  return { id: uploaded.id, unit };
}

test.describe('Annuler dans l’explorateur (UI, #151)', () => {
  test('Suppr puis « Annuler » : le document réapparaît dans la grille', async ({
    page,
    loginAs,
    request,
    adminApi,
    adminToken,
    runId,
  }) => {
    const title = `ui-suppr-${runId}`;
    const doc = await adminApi.uploadDocument(`${title}.txt`, title, `Contenu ${runId}`);
    const before = pick(await getDoc(request, adminToken, doc.id), PLACEMENT);

    await loginAs('tenant_admin');
    await page.goto(`spaces?q=${encodeURIComponent(runId)}`);
    const item = itemOf(page, title);
    await item.focus();
    await page.keyboard.press('Delete');
    await expect(item).toHaveCount(0);
    expect(await trashIds(request, adminToken)).toContain(doc.id);

    const toast = toastFor(page, `« ${title} » mis à la corbeille`);
    await toast.getByRole('button', { name: 'Annuler' }).click();
    await expect(item).toBeVisible();
    await expect(toast).toHaveCount(0);
    expect(await trashIds(request, adminToken)).not.toContain(doc.id);
    expect(pick(await getDoc(request, adminToken, doc.id), PLACEMENT)).toEqual(before);
  });

  test('glisser-déposer puis « Annuler » : retour au dossier de départ, audit « reclassify »', async ({
    page,
    loginAs,
    request,
    adminApi,
    adminToken,
    runId,
  }) => {
    const title = `ui-glisse-${runId}`;
    const { id, unit } = await filedDoc(request, adminToken, adminApi, title);
    const filed = pick(await getDoc(request, adminToken, id), PLACEMENT);

    await loginAs('tenant_admin');
    await page.goto('spaces');
    const item = itemOf(page, title);
    await dragToDaf(page, item);
    const toast = toastFor(page, `« ${title} » déplacé vers`);
    await expect(toast).toBeVisible();
    await expect(item).toHaveCount(0);
    expect((await getDoc(request, adminToken, id)).classification_target_org_unit_id).not.toBe(unit);

    await toast.getByRole('button', { name: 'Annuler' }).click();
    await expect(item).toBeVisible();
    expect(pick(await getDoc(request, adminToken, id), PLACEMENT)).toEqual(filed);

    const mine = await reclassifyLog(request, adminToken, id);
    expect(mine).toHaveLength(3); // filing, drag, undo
    expectInverse(mine);
  });

  test('pas d’« Annuler » depuis l’espace d’une personne ni pour un document sans unité cible', async ({
    page,
    loginAs,
    request,
    adminApi,
    adminToken,
    runId,
  }) => {
    // The explorer only drops on unit folders, so "towards a person" cannot happen; "from a person" can.
    const me = await adminApi.me();
    const personTitle = `ui-perso-${runId}`;
    await filedDoc(request, adminToken, adminApi, personTitle, {
      classification_scope: 'person',
      classification_target_user_id: me.id,
    });
    const looseTitle = `ui-libre-${runId}`;
    const loose = await adminApi.uploadDocument(`${looseTitle}.txt`, looseTitle, `Contenu ${runId}`);
    expect((await getDoc(request, adminToken, loose.id)).classification_target_org_unit_id ?? null).toBeNull();

    await loginAs('tenant_admin');
    await page.goto('spaces');
    for (const title of [personTitle, looseTitle]) {
      const item = itemOf(page, title);
      await expect(item).toBeVisible();
      await dragToDaf(page, item);
      const toast = toastFor(page, `« ${title} » déplacé vers`);
      await expect(toast).toBeVisible();
      // The grid reloads after a move: wait for it before the next drag.
      await expect(item).toHaveCount(0);
      await expect(toast.getByRole('button', { name: 'Annuler' })).toHaveCount(0);
      await toast.getByRole('button', { name: 'Fermer le message' }).click();
      await expect(toast).toHaveCount(0);
    }
  });

  test('Ctrl+Z annule seulement la dernière action', async ({ page, loginAs, request, adminApi, adminToken, runId }) => {
    const deletedTitle = `ui-z-suppr-${runId}`;
    const deleted = await adminApi.uploadDocument(`${deletedTitle}.txt`, deletedTitle, `Contenu ${runId}`);
    const movedTitle = `ui-z-glisse-${runId}`;
    const moved = await filedDoc(request, adminToken, adminApi, movedTitle);

    await loginAs('tenant_admin');
    await page.goto('spaces');
    const deletedItem = itemOf(page, deletedTitle);
    await deletedItem.focus();
    await page.keyboard.press('Delete');
    await expect(deletedItem).toHaveCount(0);
    const movedItem = itemOf(page, movedTitle);
    await dragToDaf(page, movedItem);
    await expect(toastFor(page, `« ${movedTitle} » déplacé vers`)).toBeVisible();

    await page.keyboard.press('Control+z');
    await expect(movedItem).toBeVisible();
    expect((await getDoc(request, adminToken, moved.id)).classification_target_org_unit_id).toBe(moved.unit);
    await expect(page.getByRole('button', { name: 'Annuler' })).toHaveCount(0);

    // Nothing left to undo: the first document stays in the trash.
    await page.keyboard.press('Control+z');
    await expect(deletedItem).toHaveCount(0);
    expect(await trashIds(request, adminToken)).toContain(deleted.id);
  });
});
