import type { APIRequestContext } from '@playwright/test';
import { test, expect, API_URL } from '../../fixtures/uat.fixture';

/**
 * Post-rc1 L4 (#151, server side #179): "Annuler" after Suppr or after a drag-and-drop move.
 * - Suppr = trash; Annuler = POST /documents/{id}/restore.
 * - Move = PATCH /documents/{id} with a new classification; Annuler = the same PATCH with the 7 previous
 *   classification fields. Each move is audited as "reclassify" with before/after.
 * API tests run now against #179; UI tests are fixme until the explorer gets the Annuler button and Ctrl+Z.
 * Each test creates its own domains and document (runId), so the spec replays on any database.
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

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const pick = (doc: Doc, keys: readonly string[]) => Object.fromEntries(keys.map((k) => [k, doc[k] ?? null]));

async function patch(request: APIRequestContext, token: string, id: string, data: object): Promise<Doc> {
  const res = await request.patch(`${API_URL}/documents/${id}`, { headers: auth(token), data });
  expect(res.status(), await res.text()).toBe(200);
  return (await res.json()) as Doc;
}

test.describe('Annuler une suppression ou un déplacement (API, #179)', () => {
  test('Suppr puis Annuler : le document revient à la même place', async ({ request, adminApi, adminToken, runId }) => {
    const doc = await adminApi.uploadDocument(`undo-del-${runId}.txt`, `Undo del ${runId}`, `Contenu ${runId}`);
    const get = async () =>
      (await (await request.get(`${API_URL}/documents/${doc.id}`, { headers: auth(adminToken) })).json()) as Doc;
    const before = pick(await get(), PLACEMENT);

    expect((await request.delete(`${API_URL}/documents/${doc.id}`, { headers: auth(adminToken) })).status()).toBe(204);
    expect((await request.post(`${API_URL}/documents/${doc.id}/restore`, { headers: auth(adminToken) })).status()).toBe(200);
    expect(pick(await get(), PLACEMENT)).toEqual(before);
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
    expect(units.length, 'au moins deux unités actives').toBeGreaterThanOrEqual(2);
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
    const home = await place('undo-a', units[0].id, 2026);
    const elsewhere = await place('undo-b', units[1].id, 2025);
    const doc = await adminApi.uploadDocument(`undo-mv-${runId}.txt`, `Undo move ${runId}`, `Contenu ${runId}`);

    const filed = pick(await patch(request, adminToken, doc.id, home), PLACEMENT);
    const moved = await patch(request, adminToken, doc.id, elsewhere);
    expect(moved.org_unit_id).toBe(units[1].id);
    expect(moved.logical_space_path).not.toBe(filed.logical_space_path);

    // Annuler = the same PATCH with the classification kept before the drag.
    const undone = await patch(request, adminToken, doc.id, pick(filed as Doc, CLASSIFICATION));
    expect(pick(undone, PLACEMENT)).toEqual(filed);

    const logs = (await (
      await request.get(`${API_URL}/audit/logs`, {
        headers: auth(adminToken),
        params: { action: 'reclassify', table_name: 'documents', limit: '500' },
      })
    ).json()) as { record_id: string; created_at: string; new_data: { before: Doc; after: Doc } }[];
    const mine = logs.filter((l) => l.record_id === doc.id).sort((a, b) => a.created_at.localeCompare(b.created_at));
    expect(mine).toHaveLength(3); // filing, move, undo
    const [, move, undo] = mine;
    expect(undo.new_data.before).toEqual(move.new_data.after);
    expect(undo.new_data.after).toEqual(move.new_data.before);
  });
});

// UI part of #151 (explorer): enable when the Annuler button (10 s) and Ctrl+Z land.
test.describe('Annuler dans l’explorateur (UI, #151)', () => {
  test.fixme('Suppr puis « Annuler » : le document réapparaît dans la grille', async () => {
    // Select a document, press Delete, click "Annuler" in the toast within 10 s; expect the tile back and
    // the document absent from /documents/trash.
  });

  test.fixme('glisser-déposer puis « Annuler » : retour au dossier de départ, audit « reclassify »', async () => {
    // Drag a document to another space, click "Annuler"; expect it back in the source space and two
    // reclassify entries for it (move + undo) in /audit/logs.
  });

  test.fixme('pas d’« Annuler » vers l’espace d’une personne ni pour un document sans unité cible', async () => {
    // #179 limits: a move to a person space changes the owner, and a document without
    // classification_target_org_unit_id does not get its unit back; the toast must offer no Annuler.
  });

  test.fixme('Ctrl+Z annule seulement la dernière action', async () => {
    // Delete A, then move B; Ctrl+Z undoes the move of B only (A stays in the trash); a second Ctrl+Z does nothing.
  });
});
