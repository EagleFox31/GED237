import { test, expect, type APIRequestContext } from '@playwright/test';
import {
  API_URL, UatApi, apiLogin, type UploadedDocument,
} from '../fixtures/uat.fixture';
import type { UserRole } from '../fixtures/auth.fixture';
import { uniqueTextFile } from '../data/files';

/**
 * #247 / #263 — Hors du périmètre de l'appelant, une route de document par identifiant ne révèle
 * pas l'existence du document : la réponse pour l'id caché est identique (statut et corps) à celle
 * pour un id inexistant, et n'est jamais 2xx. Sur les routes qui chargent le document avant de
 * vérifier le droit, cette réponse est 404.
 *
 * Document cible : déposé par l'admin institution. Le cas d'un rôle est ignoré si ce rôle lit
 * réellement le document (GET 200) : le périmètre suit l'arbre des unités, pas seulement l'unité
 * de l'appelant. Appels API directs : un écran n'appelle jamais ces routes pour un document caché.
 */

type Response = { status(): number; text(): Promise<string> };
type Route = {
  label: string;
  /** Le droit est vérifié avant de charger le document : 403 pour tout id, existant ou non. */
  rightCheckedFirst?: boolean;
  send: (req: APIRequestContext, headers: Record<string, string>, id: string) => Promise<Response>;
};

const doc = (id: string, suffix = '') => `${API_URL}/documents/${id}${suffix}`;

/** Les 18 routes par id de documents.py et workflows.py (branche #263, 723140c). */
const BY_ID_ROUTES: Route[] = [
  { label: 'GET /documents/{id}', send: (r, headers, id) => r.get(doc(id), { headers }) },
  { label: 'GET /documents/{id}/versions', send: (r, headers, id) => r.get(doc(id, '/versions'), { headers }) },
  { label: 'GET /documents/{id}/content', send: (r, headers, id) => r.get(doc(id, '/content'), { headers }) },
  { label: 'GET /documents/{id}/ocr', send: (r, headers, id) => r.get(doc(id, '/ocr'), { headers }) },
  { label: 'GET /documents/{id}/audit-logs', send: (r, headers, id) => r.get(doc(id, '/audit-logs'), { headers }) },
  { label: 'PATCH /documents/{id}', send: (r, headers, id) => r.patch(doc(id), { headers, data: { title: 'Renommage hors périmètre' } }) },
  {
    label: 'POST /documents/{id}/resolve-review',
    rightCheckedFirst: true,
    send: (r, headers, id) => r.post(doc(id, '/resolve-review'), { headers, data: { mark_as_resolved: true } }),
  },
  {
    label: 'POST /documents/{id}/start-workflow',
    rightCheckedFirst: true,
    send: (r, headers, id) => r.post(doc(id, '/start-workflow'), { headers }),
  },
  {
    label: 'POST /documents/{id}/versions',
    send: (r, headers, id) => r.post(doc(id, '/versions'), { headers, multipart: { file: uniqueTextFile('version.txt') } }),
  },
  { label: 'POST /documents/{id}/lock', send: (r, headers, id) => r.post(doc(id, '/lock'), { headers }) },
  { label: 'POST /documents/{id}/refresh-lock', send: (r, headers, id) => r.post(doc(id, '/refresh-lock'), { headers }) },
  { label: 'POST /documents/{id}/unlock', send: (r, headers, id) => r.post(doc(id, '/unlock'), { headers }) },
  { label: 'POST /documents/{id}/trash', send: (r, headers, id) => r.post(doc(id, '/trash'), { headers }) },
  { label: 'POST /documents/{id}/restore', send: (r, headers, id) => r.post(doc(id, '/restore'), { headers }) },
  {
    label: 'DELETE /documents/{id}/purge',
    rightCheckedFirst: true,
    send: (r, headers, id) => r.delete(doc(id, '/purge'), { headers }),
  },
  { label: 'DELETE /documents/{id}', send: (r, headers, id) => r.delete(doc(id), { headers }) },
  { label: 'GET /workflows/document/{id}/steps', send: (r, headers, id) => r.get(`${API_URL}/workflows/document/${id}/steps`, { headers }) },
  { label: 'GET /workflows/document/{id}/actions', send: (r, headers, id) => r.get(`${API_URL}/workflows/document/${id}/actions`, { headers }) },
];

const NONEXISTENT_ID = '00000000-0000-4000-8000-000000000000';

/** Champs propres à chaque requête (handlers.py, domain.py) : retirés avant comparaison. */
const PER_REQUEST_FIELDS = new Set(['correlation_id']);

const withoutPerRequest = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(withoutPerRequest);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value)
      .filter(([key]) => !PER_REQUEST_FIELDS.has(key))
      .map(([key, inner]) => [key, withoutPerRequest(inner)]));
  }
  return value;
};

/** Corps comparable : JSON sans les champs propres à la requête, sinon texte brut. */
const comparableBody = (raw: string): unknown => {
  try {
    return withoutPerRequest(JSON.parse(raw));
  } catch {
    return raw;
  }
};
const ROLES: UserRole[] = ['collaborator', 'reader', 'manager'];

test.describe('Périmètre : un document caché répond comme un document inexistant (#247)', () => {
  test.describe.configure({ mode: 'serial' });

  let target: UploadedDocument;
  let adminApi: UatApi;

  test.beforeAll(async ({ request }) => {
    adminApi = new UatApi(request, await apiLogin(request, 'tenant_admin'));
    const file = uniqueTextFile('perimetre-404.txt');
    const uploaded = await adminApi.uploadDocument(file.name, 'Périmètre 404', file.buffer.toString('utf-8'));
    target = await adminApi.getDocument(uploaded.id);
  });

  for (const role of ROLES) {
    test(`${role} hors périmètre : même réponse qu'un id inexistant, sur chaque route`, async ({ request }) => {
      const headers = { Authorization: `Bearer ${await apiLogin(request, role)}` };
      const probe = await request.get(doc(target.id), { headers });
      test.skip(probe.status() === 200, `${role} lit ce document : il est dans son périmètre`);

      const wrong: string[] = [];
      for (const route of BY_ID_ROUTES) {
        const hidden = await route.send(request, headers, target.id);
        const missing = await route.send(request, headers, NONEXISTENT_ID);
        const [hiddenBody, missingBody] = [await hidden.text(), await missing.text()];
        const expected = route.rightCheckedFirst ? missing.status() : 404;
        if (hidden.status() >= 200 && hidden.status() < 300) {
          wrong.push(`${route.label} → ${hidden.status()} (succès hors périmètre)`);
        } else if (
          hidden.status() !== missing.status()
          || JSON.stringify(comparableBody(hiddenBody)) !== JSON.stringify(comparableBody(missingBody))
        ) {
          wrong.push(`${route.label} → caché ${hidden.status()} ${hiddenBody} ≠ inexistant ${missing.status()} ${missingBody}`);
        } else if (hidden.status() !== expected) {
          wrong.push(`${route.label} → ${hidden.status()}, attendu 404`);
        }
      }
      expect(wrong, 'routes qui révèlent le document hors périmètre').toEqual([]);
    });
  }

  test('le document est intact après les appels hors périmètre', async ({ request }) => {
    // getDocument échoue si le document a été mis à la corbeille ou purgé.
    const after = await adminApi.getDocument(target.id);
    expect(after.title).toBe(target.title);
    expect(after.current_version_id).toBe(target.current_version_id);

    // Pas de réservation posée par un autre : l'admin la prend (423 sinon) puis la rend.
    const headers = { Authorization: `Bearer ${await apiLogin(request, 'tenant_admin')}` };
    expect((await request.post(doc(target.id, '/lock'), { headers })).status()).toBe(200);
    expect((await request.post(doc(target.id, '/unlock'), { headers })).status()).toBe(200);
  });
});
