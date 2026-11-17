import type { APIRequestContext } from '@playwright/test';
import { test, expect, API_URL, apiLogin, UatApi } from '../../fixtures/uat.fixture';

/**
 * Post-rc1 L2 (#152): DELETE /documents/{id} moves to the trash; permanent deletion only from the trash.
 * API only, real backend. Purge needs `documents manage` (policy.csv: super_admin only) and looks the
 * document up in the caller's tenant, so the purging account uploads its own documents. Each test uploads
 * its own document (runId), so the spec replays on any database.
 */
test.describe('Corbeille : suppression, restauration, purge', () => {
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  const trashedIds = async (request: APIRequestContext, token: string) => {
    const res = await request.get(`${API_URL}/documents/trash`, { headers: auth(token), params: { limit: '200' } });
    expect(res.status()).toBe(200);
    return ((await res.json()) as { id: string }[]).map((d) => d.id);
  };

  test('purge refusée sans le droit (403) et sur un document qui n’est pas dans la corbeille (409)', async ({
    request,
    adminApi,
    adminToken,
    runId,
  }) => {
    // Institution admin: may trash, may not purge.
    const own = await adminApi.uploadDocument(`admin-${runId}.txt`, `Admin ${runId}`, `Contenu admin ${runId}`);
    expect((await request.delete(`${API_URL}/documents/${own.id}`, { headers: auth(adminToken) })).status()).toBe(204);
    expect((await request.delete(`${API_URL}/documents/${own.id}/purge`, { headers: auth(adminToken) })).status()).toBe(403);
    expect(await trashedIds(request, adminToken)).toContain(own.id);

    const token = await apiLogin(request, 'super_admin');
    const doc = await new UatApi(request, token).uploadDocument(`actif-${runId}.txt`, `Actif ${runId}`, `Contenu ${runId}`);
    const purge = await request.delete(`${API_URL}/documents/${doc.id}/purge`, { headers: auth(token) });
    expect(purge.status()).toBe(409);
    expect((await purge.json()).detail.error).toBe('document_not_in_trash');

    // Still there, still active.
    expect((await request.get(`${API_URL}/documents/${doc.id}`, { headers: auth(token) })).status()).toBe(200);
    expect(await trashedIds(request, token)).not.toContain(doc.id);
  });

  test('DELETE met à la corbeille, restauration, puis purge définitive', async ({ request, runId }) => {
    const token = await apiLogin(request, 'super_admin');
    const doc = await new UatApi(request, token).uploadDocument(`cycle-${runId}.txt`, `Cycle ${runId}`, `Contenu ${runId}`);
    const call = (method: 'delete' | 'post', path: string) =>
      request[method](`${API_URL}/documents/${doc.id}${path}`, { headers: auth(token) });

    // DELETE keeps its 204 contract but only trashes the document.
    expect((await call('delete', '')).status()).toBe(204);
    expect(await trashedIds(request, token)).toContain(doc.id);
    // Idempotent: a second DELETE on a trashed document is still 204.
    expect((await call('delete', '')).status()).toBe(204);

    expect((await call('post', '/restore')).status()).toBe(200);
    expect(await trashedIds(request, token)).not.toContain(doc.id);
    expect((await call('delete', '/purge')).status()).toBe(409);

    expect((await call('delete', '')).status()).toBe(204);
    expect((await call('delete', '/purge')).status()).toBe(200);
    expect(await trashedIds(request, token)).not.toContain(doc.id);
    expect((await request.get(`${API_URL}/documents/${doc.id}`, { headers: auth(token) })).status()).toBe(404);
  });
});
