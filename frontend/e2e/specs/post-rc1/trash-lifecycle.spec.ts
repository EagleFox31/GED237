import type { APIRequestContext } from '@playwright/test';
import { test, expect, API_URL } from '../../fixtures/uat.fixture';

/**
 * Post-rc1 L2 (#152): DELETE /documents/{id} moves to the trash; permanent deletion only from the trash.
 * API only, real backend. Each test uploads its own document (runId), so the spec replays on any database.
 */
test.describe('Corbeille : suppression, restauration, purge', () => {
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  const trashedIds = async (request: APIRequestContext, token: string) => {
    const res = await request.get(`${API_URL}/documents/trash`, { headers: auth(token), params: { limit: '200' } });
    expect(res.status()).toBe(200);
    return ((await res.json()) as { id: string }[]).map((d) => d.id);
  };

  test('purge refusée (409) sur un document qui n’est pas dans la corbeille', async ({ request, adminApi, adminToken, runId }) => {
    const doc = await adminApi.uploadDocument(`actif-${runId}.txt`, `Actif ${runId}`, `Contenu ${runId}`);

    const purge = await request.delete(`${API_URL}/documents/${doc.id}/purge`, { headers: auth(adminToken) });
    expect(purge.status()).toBe(409);
    expect((await purge.json()).detail.error).toBe('document_not_in_trash');

    // Still there, still active.
    expect((await request.get(`${API_URL}/documents/${doc.id}`, { headers: auth(adminToken) })).status()).toBe(200);
    expect(await trashedIds(request, adminToken)).not.toContain(doc.id);
  });

  test('DELETE met à la corbeille, restauration, puis purge définitive', async ({ request, adminApi, adminToken, runId }) => {
    const doc = await adminApi.uploadDocument(`cycle-${runId}.txt`, `Cycle ${runId}`, `Contenu ${runId}`);

    // DELETE keeps its 204 contract but only trashes the document.
    expect((await request.delete(`${API_URL}/documents/${doc.id}`, { headers: auth(adminToken) })).status()).toBe(204);
    expect(await trashedIds(request, adminToken)).toContain(doc.id);
    // Idempotent: a second DELETE on a trashed document is still 204.
    expect((await request.delete(`${API_URL}/documents/${doc.id}`, { headers: auth(adminToken) })).status()).toBe(204);

    expect((await request.post(`${API_URL}/documents/${doc.id}/restore`, { headers: auth(adminToken) })).status()).toBe(200);
    expect(await trashedIds(request, adminToken)).not.toContain(doc.id);
    expect((await request.delete(`${API_URL}/documents/${doc.id}/purge`, { headers: auth(adminToken) })).status()).toBe(409);

    expect((await request.delete(`${API_URL}/documents/${doc.id}`, { headers: auth(adminToken) })).status()).toBe(204);
    const purge = await request.delete(`${API_URL}/documents/${doc.id}/purge`, { headers: auth(adminToken) });
    expect(purge.status()).toBe(200);
    expect(await trashedIds(request, adminToken)).not.toContain(doc.id);
    expect((await request.get(`${API_URL}/documents/${doc.id}`, { headers: auth(adminToken) })).status()).toBe(404);
  });
});
