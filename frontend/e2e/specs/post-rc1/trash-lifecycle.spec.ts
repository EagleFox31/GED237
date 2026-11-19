import type { APIRequestContext } from '@playwright/test';
import { test, expect, API_URL, apiLogin } from '../../fixtures/uat.fixture';

/**
 * Post-rc1 L2 (#152): DELETE /documents/{id} moves to the trash; permanent deletion only from the trash.
 * API only, real backend, institution admin (MINFI001). Each test uploads its own document (runId), so the
 * spec replays on any database.
 * Purge needs `documents purge` (policy.csv: tenant_admin; super_admin through manage); the unit admin is
 * refused. POST /documents/trash/empty is left to backend/tests/api/test_trash_purge.py: it empties the whole
 * institution trash and would remove documents other specs running in parallel have just trashed.
 */
test.describe('Corbeille : suppression, restauration, purge', () => {
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

  test('purge : refusée hors corbeille et à l’admin d’unité, puis définitive pour l’admin d’institution', async ({
    request,
    adminApi,
    adminToken,
    runId,
  }) => {
    const doc = await adminApi.uploadDocument(`purge-${runId}.txt`, `Purge ${runId}`, `Contenu purge ${runId}`);
    const purge = (token: string) => request.delete(`${API_URL}/documents/${doc.id}/purge`, { headers: auth(token) });
    const unitAdminToken = await apiLogin(request, 'unit_admin');

    // Active document: purge only from the trash.
    const active = await purge(adminToken);
    expect(active.status()).toBe(409);
    expect(JSON.stringify(await active.json())).toContain('document_not_in_trash');

    expect((await request.delete(`${API_URL}/documents/${doc.id}`, { headers: auth(adminToken) })).status()).toBe(204);

    // Unit admin has no purge right: refused, the document stays in the trash.
    expect((await purge(unitAdminToken)).status()).toBe(403);
    expect(await trashedIds(request, adminToken)).toContain(doc.id);

    // Institution admin: permanent deletion, gone from the trash and from the documents.
    expect((await purge(adminToken)).status()).toBe(200);
    expect(await trashedIds(request, adminToken)).not.toContain(doc.id);
    expect((await request.get(`${API_URL}/documents/${doc.id}`, { headers: auth(adminToken) })).status()).toBe(404);
    // Purging again: nothing left to purge.
    expect((await purge(adminToken)).status()).toBe(404);
  });
});
