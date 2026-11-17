import type { APIRequestContext } from '@playwright/test';
import { test, expect, API_URL } from '../../fixtures/uat.fixture';

/**
 * Post-rc1 L2 (#152): DELETE /documents/{id} moves to the trash; permanent deletion only from the trash.
 * API only, real backend, institution admin (MINFI001). Each test uploads its own document (runId), so the
 * spec replays on any database.
 * Purge needs `documents manage` (policy.csv: super_admin only) and looks the document up in the caller's
 * tenant; the seeded super_admin has no org unit and cannot upload, so no seeded account can purge an
 * institution document. Here: the institution admin is refused (403). Purge 409/200 and its audit are
 * covered by backend/tests/api/test_trash_purge.py.
 */
test.describe('Corbeille : suppression, restauration, purge refusée', () => {
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  const trashedIds = async (request: APIRequestContext, token: string) => {
    const res = await request.get(`${API_URL}/documents/trash`, { headers: auth(token), params: { limit: '200' } });
    expect(res.status()).toBe(200);
    return ((await res.json()) as { id: string }[]).map((d) => d.id);
  };

  test('DELETE met à la corbeille (idempotent), restauration, document de nouveau actif', async ({
    request,
    adminApi,
    adminToken,
    runId,
  }) => {
    const doc = await adminApi.uploadDocument(`cycle-${runId}.txt`, `Cycle ${runId}`, `Contenu ${runId}`);
    const call = (method: 'delete' | 'post', path: string) =>
      request[method](`${API_URL}/documents/${doc.id}${path}`, { headers: auth(adminToken) });

    // DELETE keeps its 204 contract but only trashes the document.
    expect((await call('delete', '')).status()).toBe(204);
    expect(await trashedIds(request, adminToken)).toContain(doc.id);
    // Idempotent: a second DELETE on a trashed document is still 204.
    expect((await call('delete', '')).status()).toBe(204);

    expect((await call('post', '/restore')).status()).toBe(200);
    expect(await trashedIds(request, adminToken)).not.toContain(doc.id);
    expect((await request.get(`${API_URL}/documents/${doc.id}`, { headers: auth(adminToken) })).status()).toBe(200);
  });

  test('purge refusée à l’admin d’institution, actif ou en corbeille ; le document reste en corbeille', async ({
    request,
    adminApi,
    adminToken,
    runId,
  }) => {
    const doc = await adminApi.uploadDocument(`purge-${runId}.txt`, `Purge ${runId}`, `Contenu purge ${runId}`);
    const purge = () => request.delete(`${API_URL}/documents/${doc.id}/purge`, { headers: auth(adminToken) });

    expect((await purge()).status()).toBe(403);
    expect((await request.delete(`${API_URL}/documents/${doc.id}`, { headers: auth(adminToken) })).status()).toBe(204);
    expect((await purge()).status()).toBe(403);
    expect(await trashedIds(request, adminToken)).toContain(doc.id);
  });
});
