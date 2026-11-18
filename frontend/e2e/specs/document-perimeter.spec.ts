import { test, expect, type APIRequestContext } from '@playwright/test';
import {
  API_URL, UatApi, apiLogin, type UploadedDocument,
} from '../fixtures/uat.fixture';
import type { UserRole } from '../fixtures/auth.fixture';
import { uniqueTextFile } from '../data/files';

/**
 * #247 / #263 — Hors du périmètre de l'appelant, toute route de document par identifiant répond
 * 404, comme pour un document inexistant : jamais 403 (qui confirmerait l'existence) ni 200.
 *
 * Document cible : déposé par l'admin institution, donc hors du périmètre du collaborateur
 * (ses propres documents seulement). Lecteur et manager : hors périmètre seulement si leur unité
 * n'est pas celle du document, sinon le cas est ignoré (le seed ne le garantit pas).
 * Appels API directs : un écran n'appelle jamais ces routes pour un document qu'il ne voit pas.
 */

type Call = { label: string; send: (req: APIRequestContext, headers: Record<string, string>, id: string) => Promise<{ status(): number; text(): Promise<string> }> };

const doc = (id: string, suffix = '') => `${API_URL}/documents/${id}${suffix}`;

/** Toutes les routes par id de documents.py et workflows.py (branche #263). */
const BY_ID_ROUTES: Call[] = [
  { label: 'GET /documents/{id}', send: (r, headers, id) => r.get(doc(id), { headers }) },
  { label: 'GET /documents/{id}/versions', send: (r, headers, id) => r.get(doc(id, '/versions'), { headers }) },
  { label: 'GET /documents/{id}/content', send: (r, headers, id) => r.get(doc(id, '/content'), { headers }) },
  { label: 'GET /documents/{id}/ocr', send: (r, headers, id) => r.get(doc(id, '/ocr'), { headers }) },
  { label: 'GET /documents/{id}/audit-logs', send: (r, headers, id) => r.get(doc(id, '/audit-logs'), { headers }) },
  { label: 'PATCH /documents/{id}', send: (r, headers, id) => r.patch(doc(id), { headers, data: { title: 'Renommage hors périmètre' } }) },
  { label: 'POST /documents/{id}/resolve-review', send: (r, headers, id) => r.post(doc(id, '/resolve-review'), { headers, data: { mark_as_resolved: true } }) },
  { label: 'POST /documents/{id}/start-workflow', send: (r, headers, id) => r.post(doc(id, '/start-workflow'), { headers }) },
  {
    label: 'POST /documents/{id}/versions',
    send: (r, headers, id) => r.post(doc(id, '/versions'), { headers, multipart: { file: uniqueTextFile('version.txt') } }),
  },
  { label: 'POST /documents/{id}/lock', send: (r, headers, id) => r.post(doc(id, '/lock'), { headers }) },
  { label: 'POST /documents/{id}/refresh-lock', send: (r, headers, id) => r.post(doc(id, '/refresh-lock'), { headers }) },
  { label: 'POST /documents/{id}/unlock', send: (r, headers, id) => r.post(doc(id, '/unlock'), { headers }) },
  { label: 'POST /documents/{id}/trash', send: (r, headers, id) => r.post(doc(id, '/trash'), { headers }) },
  { label: 'POST /documents/{id}/restore', send: (r, headers, id) => r.post(doc(id, '/restore'), { headers }) },
  { label: 'DELETE /documents/{id}/purge', send: (r, headers, id) => r.delete(doc(id, '/purge'), { headers }) },
  { label: 'DELETE /documents/{id}', send: (r, headers, id) => r.delete(doc(id), { headers }) },
  { label: 'GET /workflows/document/{id}/steps', send: (r, headers, id) => r.get(`${API_URL}/workflows/document/${id}/steps`, { headers }) },
  { label: 'GET /workflows/document/{id}/actions', send: (r, headers, id) => r.get(`${API_URL}/workflows/document/${id}/actions`, { headers }) },
];

const NONEXISTENT_ID = '00000000-0000-4000-8000-000000000000';

test.describe('Périmètre : 404 sur toute route de document par id (#247)', () => {
  test.describe.configure({ mode: 'serial' });

  let target: UploadedDocument;
  let adminApi: UatApi;

  test.beforeAll(async ({ request }) => {
    adminApi = new UatApi(request, await apiLogin(request, 'tenant_admin'));
    const file = uniqueTextFile('perimetre-404.txt');
    const uploaded = await adminApi.uploadDocument(file.name, 'Périmètre 404', file.buffer.toString('utf-8'));
    target = await adminApi.getDocument(uploaded.id);
  });

  const outsideCases: Array<{ role: UserRole; needsOtherUnit: boolean }> = [
    { role: 'collaborator', needsOtherUnit: false },
    { role: 'reader', needsOtherUnit: true },
    { role: 'manager', needsOtherUnit: true },
  ];

  for (const { role, needsOtherUnit } of outsideCases) {
    test(`${role} hors périmètre : 404 partout, comme un document inexistant`, async ({ request }) => {
      const token = await apiLogin(request, role);
      const headers = { Authorization: `Bearer ${token}` };
      if (needsOtherUnit) {
        const me = await request.get(`${API_URL}/users/me`, { headers });
        expect(me.ok(), 'GET /users/me').toBeTruthy();
        const { org_unit_id: unitId } = await me.json() as { org_unit_id?: string | null };
        test.skip(Boolean(unitId) && unitId === target.org_unit_id, `${role} est dans l'unité du document : pas hors périmètre`);
      }

      const wrong: string[] = [];
      for (const route of BY_ID_ROUTES) {
        const status = (await route.send(request, headers, target.id)).status();
        if (status !== 404) wrong.push(`${route.label} → ${status}`);
      }
      expect(wrong, 'routes qui ne répondent pas 404 hors périmètre').toEqual([]);

      // Même réponse que pour un id inexistant : la 404 ne révèle pas que le document existe.
      const hidden = await request.get(doc(target.id), { headers });
      const missing = await request.get(doc(NONEXISTENT_ID), { headers });
      expect(missing.status()).toBe(404);
      expect(await hidden.text()).toBe(await missing.text());
    });
  }

  test('le document est intact après les appels hors périmètre', async () => {
    // getDocument échoue si le document a été mis à la corbeille ou purgé.
    const after = await adminApi.getDocument(target.id);
    expect(after.title).toBe(target.title);
    expect(after.current_version_id).toBe(target.current_version_id);
  });
});
