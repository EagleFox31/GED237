import { test, expect, type APIRequestContext } from '@playwright/test';
import { DEMO, DEMO_MANIFEST_FILE, type Counters } from '../data/demo';

/**
 * Demo dataset check (jeu-donnees-demo.md section 5, step 4): real counters and per-file destinations
 * against the `expected` section of the demo manifest. API-only, same login as seed.spec.ts.
 * Run with `--project=demo` on a stack reset with the demo profile.
 *
 * Wiring when D1 lands: set DEMO_MANIFEST_FILE (e2e/data/demo.ts) to 'demo-manifest.json' and AWAITING_D1 to false.
 */
const AWAITING_D1 = true;
const C2_THRESHOLD = 0.95;

const API_URL = process.env.VITE_API_URL || 'http://localhost:8000/api/v1';
const PASSWORD = process.env.DEMO_ADMIN_PASSWORD || 'Minfi@2025';
const MATRICULE = process.env.DEMO_ADMIN_MATRICULE || 'MINFI001';

interface Doc {
  id: string;
  title: string;
  source_relative_path?: string | null;
  org_unit_id?: string | null;
  classification_status: string;
  classification_domain_id?: string | null;
  classification_activity_id?: string | null;
  classification_year?: number | null;
  classification_target_org_unit_id?: string | null;
}

type Headers = Record<string, string>;

async function login(request: APIRequestContext): Promise<Headers> {
  const res = await request.post(`${API_URL}/auth/login`, {
    data: { institution: DEMO.tenant, matricule: MATRICULE, password: PASSWORD },
  });
  expect(res.ok(), `login ${MATRICULE}: ${res.status()}`).toBeTruthy();
  const { session_token, otp } = await res.json();
  expect(otp, 'the API runs with ENVIRONMENT=development and echoes the OTP').toBeTruthy();
  const verified = await request.post(`${API_URL}/auth/verify-otp`, { data: { session_token, otp } });
  expect(verified.ok(), `verify-otp: ${verified.status()}`).toBeTruthy();
  return { Authorization: `Bearer ${(await verified.json()).access_token}` };
}

async function getJson<T>(request: APIRequestContext, headers: Headers, route: string): Promise<T> {
  const res = await request.get(`${API_URL}${route}`, { headers });
  expect(res.ok(), `GET ${route}: ${res.status()}`).toBeTruthy();
  return res.json();
}

async function getAll(request: APIRequestContext, headers: Headers, route: string): Promise<Doc[]> {
  const rows: Doc[] = [];
  for (let skip = 0; ; skip += 100) {
    const page = await getJson<Doc[]>(request, headers, `${route}?skip=${skip}&limit=100`);
    rows.push(...page);
    if (page.length < 100) return rows;
  }
}

const countersOf = (docs: Doc[]): Counters => ({
  total: docs.length,
  classified: docs.filter((d) => d.classification_status === 'classified').length,
  toReview: docs.filter((d) => ['pending', 'needs_review'].includes(d.classification_status)).length,
});

const sum = (rows: Counters[], key: keyof Counters) => rows.reduce((n, r) => n + r[key], 0);

// Pure check, no stack needed: guards the manifest contract itself.
test.describe('Demo manifest contract', () => {
  const { files, documents, byOrgUnit } = DEMO.expected;

  test(`${DEMO_MANIFEST_FILE}: aggregates agree with expected.files`, () => {
    expect(documents.total, 'documents.total').toBe(files.filter((f) => f.status !== 'duplicate').length);
    expect(documents.classified, 'documents.classified').toBe(files.filter((f) => f.status === 'classified').length);
    expect(documents.toReview, 'documents.toReview').toBe(files.filter((f) => f.status === 'needs_review').length);
    expect(sum(Object.values(byOrgUnit), 'total'), 'sum of byOrgUnit.total').toBe(documents.total);
  });

  test('files carry a destination only when classified', () => {
    for (const f of files) {
      const hasDestination = [f.orgUnit, f.domain, f.activity, f.year].some((v) => v !== null);
      expect(hasDestination, f.path).toBe(f.status === 'classified');
    }
  });
});

test.describe('Demo dataset vs expected (step 4)', () => {
  test.fixme(AWAITING_D1, 'waiting for the generated demo-manifest.json (D1)');

  let headers: Headers;
  let live: Doc[];
  let trash: Doc[];
  let codes: { org: Map<string, string>; dom: Map<string, string>; act: Map<string, string> };

  test.beforeAll(async ({ request }) => {
    headers = await login(request);
    live = await getAll(request, headers, '/documents/');
    trash = await getAll(request, headers, '/documents/trash');
    const map = async (route: string) =>
      new Map((await getJson<{ id: string; code: string }[]>(request, headers, route)).map((r) => [r.id, r.code]));
    codes = {
      org: await map('/org-units/'),
      dom: await map('/classification-rules/domains'),
      act: await map('/classification-rules/activities'),
    };
  });

  test('reference data and rules', async ({ request }) => {
    const { domains, activities, classificationRules, inactiveRules } = DEMO.expected;
    expect([...codes.dom.values()]).toEqual(expect.arrayContaining(domains));
    expect([...codes.act.values()]).toEqual(expect.arrayContaining(activities));
    const rules = await getJson<{ code: string; is_active: boolean }[]>(request, headers, '/classification-rules/rules');
    expect(rules.map((r) => r.code)).toEqual(expect.arrayContaining(classificationRules));
    expect(rules.filter((r) => !r.is_active).map((r) => r.code).sort()).toEqual([...inactiveRules].sort());
  });

  test('document counters, global and per org unit (trash included in total)', () => {
    const all = [...live, ...trash];
    expect(countersOf(all)).toEqual(DEMO.expected.documents);
    for (const [unit, expected] of Object.entries(DEMO.expected.byOrgUnit)) {
      const docs = all.filter((d) => codes.org.get(d.org_unit_id ?? '') === unit);
      expect(countersOf(docs), `org unit ${unit}`).toEqual(expected);
    }
  });

  test('trash and versions', async ({ request }) => {
    expect(trash.map((d) => d.title).sort()).toEqual([...DEMO.expected.trash].sort());
    for (const [title, count] of Object.entries(DEMO.expected.versions)) {
      const doc = live.find((d) => d.title === title);
      expect(doc, `document "${title}"`).toBeTruthy();
      expect(await getJson<unknown[]>(request, headers, `/documents/${doc!.id}/versions`), title).toHaveLength(count);
    }
  });

  test(`C2: covered files are classified at their destination (>= ${C2_THRESHOLD * 100} %)`, () => {
    const byPath = new Map(live.map((d) => [d.source_relative_path, d]));
    const covered = DEMO.expected.files.filter((f) => f.status === 'classified');
    const deviations: string[] = [];
    const failed = new Set<string>();
    const flag = (path: string, message: string) => {
      failed.add(path);
      deviations.push(message);
    };
    for (const f of covered) {
      const d = byPath.get(f.path);
      if (!d) {
        flag(f.path, `ABSENT ${f.path}`);
      } else if (d.classification_status !== 'classified') {
        flag(f.path, `NON CLASSE ${f.path} (${d.classification_status})`);
      } else {
        const got = {
          orgUnit: codes.org.get(d.classification_target_org_unit_id ?? '') ?? null,
          domain: codes.dom.get(d.classification_domain_id ?? '') ?? null,
          activity: codes.act.get(d.classification_activity_id ?? '') ?? null,
          year: d.classification_year ?? null,
        };
        for (const k of ['orgUnit', 'domain', 'activity', 'year'] as const) {
          if (f[k] !== null && got[k] !== f[k]) flag(f.path, `DESTINATION ${f.path} ${k}: attendu ${f[k]} obtenu ${got[k]}`);
        }
      }
    }
    const rate = (covered.length - failed.size) / covered.length;
    expect(rate, `C2 deviations:\n${deviations.join('\n')}`).toBeGreaterThanOrEqual(C2_THRESHOLD);
  });

  test('refused duplicates are not stored', () => {
    const known = new Set([...live, ...trash].map((d) => d.source_relative_path));
    for (const f of DEMO.expected.files.filter((x) => x.status === 'duplicate')) {
      expect(known.has(f.path), `duplicate ${f.path}`).toBe(false);
    }
  });
});
