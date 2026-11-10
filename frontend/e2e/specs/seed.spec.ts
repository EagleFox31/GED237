import { test, expect, type APIRequestContext } from '@playwright/test';
import { SEED } from '../data/seed';

/**
 * Checks, through the API, that the E2E stack holds the data of e2e/data/seed-manifest.json
 * (loaded by backend/scripts/seed_e2e.py before the API starts). The smoke project depends on it:
 * a missing seed fails here with the list of what is absent, not later as an unrelated UI timeout.
 */

const API_URL = process.env.VITE_API_URL || 'http://localhost:8000/api/v1';
const PASSWORDS: Record<string, string> = { MINFI001: 'Minfi@2025', MGR001: 'Mgr@2025' };

async function login(request: APIRequestContext, matricule: string): Promise<Record<string, string>> {
  const res = await request.post(`${API_URL}/auth/login`, {
    data: { institution: SEED.tenant, matricule, password: PASSWORDS[matricule] },
  });
  expect(res.ok(), `login ${matricule}: ${res.status()}`).toBeTruthy();
  const { session_token, otp } = await res.json();
  expect(otp, 'the E2E API runs with ENVIRONMENT=development and echoes the OTP').toBeTruthy();
  const verified = await request.post(`${API_URL}/auth/verify-otp`, { data: { session_token, otp } });
  expect(verified.ok(), `verify-otp ${matricule}: ${verified.status()}`).toBeTruthy();
  return { Authorization: `Bearer ${(await verified.json()).access_token}` };
}

async function getJson<T>(request: APIRequestContext, headers: Record<string, string>, route: string): Promise<T> {
  const res = await request.get(`${API_URL}${route}`, { headers });
  expect(res.ok(), `GET ${route}: ${res.status()}`).toBeTruthy();
  return res.json();
}

const codes = (rows: { code: string }[]) => rows.map((r) => r.code);

test.describe('E2E seed (seed-manifest.json)', () => {
  let admin: Record<string, string>;

  test.beforeAll(async ({ request }) => {
    admin = await login(request, 'MINFI001');
  });

  test('reference data: categories, classification plan, circuit', async ({ request }) => {
    const { expected } = SEED;
    expect(codes(await getJson(request, admin, '/categories/'))).toEqual(expect.arrayContaining(expected.categories));
    expect(codes(await getJson(request, admin, '/classification-rules/domains'))).toEqual(
      expect.arrayContaining(expected.domains),
    );
    expect(codes(await getJson(request, admin, '/classification-rules/activities'))).toEqual(
      expect.arrayContaining(expected.activities),
    );
    expect(codes(await getJson(request, admin, '/classification-rules/rules'))).toEqual(
      expect.arrayContaining(expected.classificationRules),
    );
    expect(codes(await getJson(request, admin, '/gedrules/templates'))).toEqual(
      expect.arrayContaining(expected.workflowTemplates),
    );
    expect(codes(await getJson(request, admin, '/gedrules/rules'))).toEqual(expect.arrayContaining(expected.routingRules));
  });

  test('pending validation tasks are assigned', async ({ request }) => {
    for (const [matricule, titles] of Object.entries(SEED.expected.pendingTasks)) {
      const headers = await login(request, matricule);
      const pending = await getJson<{ document?: { title: string } }[]>(request, headers, '/workflows/pending');
      expect(pending.map((step) => step.document?.title), `pending tasks of ${matricule}`).toEqual(
        expect.arrayContaining(titles),
      );
    }
  });

  test('trash and version history', async ({ request }) => {
    const trashed = await getJson<{ title: string }[]>(request, admin, '/documents/trash');
    expect(trashed.map((d) => d.title)).toEqual(expect.arrayContaining(SEED.expected.trash));

    const documents = await getJson<{ id: string; title: string }[]>(request, admin, '/documents/?limit=500');
    for (const [title, count] of Object.entries(SEED.expected.versions)) {
      const document = documents.find((d) => d.title === title);
      expect(document, `document "${title}"`).toBeTruthy();
      const versions = await getJson<unknown[]>(request, admin, `/documents/${document!.id}/versions`);
      expect(versions, `versions of "${title}"`).toHaveLength(count);
    }
  });
});
