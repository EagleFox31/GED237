import { test, expect, type APIRequestContext } from '@playwright/test';
import { DEMO, DEMO_MANIFEST_FILE, type Counters } from '../data/demo';

/**
 * Demo dataset check (jeu-donnees-demo.md section 5, step 4): real counters and per-file destinations
 * against the `expected` section of the demo manifest. API-only, same login as seed.spec.ts.
 * Run with `--project=demo` on a stack reset with the demo profile.
 *
 * Wiring when D1 lands: set DEMO_MANIFEST_FILE (e2e/data/demo.ts) to 'demo-manifest.json' and AWAITING_D1 to false.
 */
const AWAITING_D1 = false;
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

  // D1 contract: classified = documents created (live + trash), toReview = open classification reviews
  // (no document). Units of another tenant (MINESUP-DAAJ) are invisible to this admin: isolation proof.
  test('document counters: classified per target unit, open reviews, isolation', async ({ request }) => {
    const all = [...live, ...trash];
    const { classified, toReview } = DEMO.expected.documents;
    expect(all.filter((d) => d.classification_status === 'classified')).toHaveLength(classified);
    expect(all, 'every stored document is classified').toHaveLength(classified);

    const visibleUnits = new Set(codes.org.values());
    for (const [unit, expected] of Object.entries(DEMO.expected.byOrgUnit)) {
      if (!visibleUnits.has(unit)) continue;
      const docs = all.filter((d) => codes.org.get(d.classification_target_org_unit_id ?? '') === unit);
      expect(docs, `classified in ${unit}`).toHaveLength(expected.classified);
    }

    const foreignReviews = Object.entries(DEMO.expected.byOrgUnit)
      .filter(([unit]) => !visibleUnits.has(unit))
      .reduce((n, [, c]) => n + c.toReview, 0);
    const reviews = await getJson<{ review_status: string }[]>(request, headers, '/classification-reviews');
    expect(reviews.filter((r) => r.review_status === 'open'), 'open reviews visible to the admin').toHaveLength(
      toReview - foreignReviews,
    );
  });

  test('trash and versions', async ({ request }) => {
    expect(trash.map((d) => d.title).sort()).toEqual([...DEMO.expected.trash].sort());
    for (const [title, count] of Object.entries(DEMO.expected.versions)) {
      const doc = [...live, ...trash].find((d) => d.title === title);
      expect(doc, `document "${title}"`).toBeTruthy();
      expect(await getJson<unknown[]>(request, headers, `/documents/${doc!.id}/versions`), title).toHaveLength(count);
    }
  });

  test(`C2: covered files are classified at their destination (>= ${C2_THRESHOLD * 100} %)`, () => {
    const byPath = new Map([...live, ...trash].map((d) => [d.source_relative_path, d]));
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

  test('files left for review have no document', () => {
    const known = new Set([...live, ...trash].map((d) => d.source_relative_path));
    for (const f of DEMO.expected.files.filter((x) => x.status === 'needs_review')) {
      expect(known.has(f.path), `review ${f.path}`).toBe(false);
    }
  });

  test('refused duplicates are not stored', () => {
    const known = new Set([...live, ...trash].map((d) => d.source_relative_path));
    for (const f of DEMO.expected.files.filter((x) => x.status === 'duplicate')) {
      expect(known.has(f.path), `duplicate ${f.path}`).toBe(false);
    }
  });
});
