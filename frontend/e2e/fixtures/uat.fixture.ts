import { test as authTest, expect, TEST_USERS, type UserRole } from './auth.fixture';
import type { APIRequestContext } from '@playwright/test';

/**
 * UAT fixture: real backend, no mocks.
 *
 * - `runId`: unique suffix per test, so every spec creates its own data and can be
 *   replayed on a non-empty database (titles, codes and file checksums never collide).
 * - `adminApi`: API helper authenticated as tenant_admin through the real 2FA endpoints
 *   (login → OTP echoed in ENVIRONMENT=development → verify-otp). The token is cached per
 *   worker to stay under the login rate limit.
 */

export const API_URL = (process.env.VITE_API_URL || 'http://localhost:8000/api/v1').replace(/\/$/, '');

export type Domain = { id: string; code: string; name: string };
export type Activity = { id: string; code: string; name: string; domain_id: string };
export type UploadedDocument = {
  id: string;
  title: string;
  classification_status: string;
  classification_domain_id: string | null;
  classification_activity_id: string | null;
  org_unit_id: string | null;
};
export type ReviewItem = { id: string; document_id: string; status?: string };
export type AuditEntry = {
  id: string;
  user_id: string | null;
  user_name?: string | null;
  table_name: string;
  record_id: string;
  resource_label?: string;
  action: string;
  action_label?: string;
  created_at: string | null;
};

async function ok<T>(res: Awaited<ReturnType<APIRequestContext['get']>>, what: string): Promise<T> {
  if (!res.ok()) {
    throw new Error(`${what} failed: HTTP ${res.status()} ${await res.text()}`);
  }
  return (await res.json()) as T;
}

export async function apiLogin(request: APIRequestContext, role: UserRole): Promise<string> {
  const creds = TEST_USERS[role];
  const login = await ok<{ session_token: string; otp?: string }>(
    await request.post(`${API_URL}/auth/login`, {
      data: { institution: creds.institution, matricule: creds.matricule, password: creds.password },
    }),
    `login ${role}`,
  );
  if (!login.otp) {
    throw new Error('OTP not echoed by /auth/login: the UAT stack must run with ENVIRONMENT=development.');
  }
  const tokens = await ok<{ access_token: string }>(
    await request.post(`${API_URL}/auth/verify-otp`, {
      data: { session_token: login.session_token, otp: login.otp },
    }),
    `verify-otp ${role}`,
  );
  return tokens.access_token;
}

export class UatApi {
  constructor(private readonly request: APIRequestContext, private readonly token: string) {}

  private get headers() {
    return { Authorization: `Bearer ${this.token}` };
  }

  async createDomain(code: string, name: string): Promise<Domain> {
    return ok(
      await this.request.post(`${API_URL}/classification-rules/domains`, {
        headers: this.headers,
        data: { code, name },
      }),
      'create domain',
    );
  }

  async createActivity(domainId: string, code: string, name: string): Promise<Activity> {
    return ok(
      await this.request.post(`${API_URL}/classification-rules/activities`, {
        headers: this.headers,
        data: { domain_id: domainId, code, name },
      }),
      'create activity',
    );
  }

  async createRule(input: {
    code: string;
    name: string;
    filenamePattern: string;
    domainId: string;
    activityId: string;
  }): Promise<{ id: string }> {
    return ok(
      await this.request.post(`${API_URL}/classification-rules/rules`, {
        headers: this.headers,
        data: {
          code: input.code,
          name: input.name,
          filename_pattern: input.filenamePattern,
          domain_id: input.domainId,
          activity_id: input.activityId,
          target_scope: 'service',
          year_strategy: 'current',
        },
      }),
      'create rule',
    );
  }

  async listRules(): Promise<Array<{ id: string; name: string; is_active: boolean; filename_pattern: string | null }>> {
    return ok(await this.request.get(`${API_URL}/classification-rules/rules`, { headers: this.headers }), 'list rules');
  }

  /** Uploads a text file; `content` must be unique per run (the tenant rejects duplicate checksums). */
  async uploadDocument(fileName: string, title: string, content: string): Promise<UploadedDocument> {
    return ok(
      await this.request.post(`${API_URL}/documents/upload`, {
        headers: this.headers,
        multipart: {
          title,
          file: { name: fileName, mimeType: 'text/plain', buffer: Buffer.from(content, 'utf-8') },
        },
      }),
      `upload ${fileName}`,
    );
  }

  async getDocument(id: string): Promise<UploadedDocument> {
    return ok(await this.request.get(`${API_URL}/documents/${id}`, { headers: this.headers }), `get document ${id}`);
  }

  async listReviews(): Promise<ReviewItem[]> {
    return ok(await this.request.get(`${API_URL}/classification-reviews`, { headers: this.headers }), 'list reviews');
  }

  async getSpaceDocuments(params: Record<string, string>) {
    return this.request.get(`${API_URL}/spaces/documents`, { headers: this.headers, params });
  }

  async resolveReview(
    reviewId: string,
    input: { domainId: string; activityId: string; year: number; targetOrgUnitId: string; comment: string },
  ): Promise<{ success: boolean; document_classification_status: string }> {
    return ok(
      await this.request.post(`${API_URL}/classification-reviews/${reviewId}/resolve`, {
        headers: this.headers,
        data: {
          classification_domain_id: input.domainId,
          classification_activity_id: input.activityId,
          classification_year: input.year,
          classification_scope: 'service',
          classification_target_org_unit_id: input.targetOrgUnitId,
          comment: input.comment,
          relaunch_workflow: false,
        },
      }),
      `resolve review ${reviewId}`,
    );
  }

  async auditLogs(params: Record<string, string> = {}): Promise<AuditEntry[]> {
    return ok(await this.request.get(`${API_URL}/audit/logs`, { headers: this.headers, params }), 'audit logs');
  }

  async documentAuditLogs(documentId: string): Promise<AuditEntry[]> {
    return ok(
      await this.request.get(`${API_URL}/documents/${documentId}/audit-logs`, { headers: this.headers }),
      `document audit logs ${documentId}`,
    );
  }

  /** Raw upload: returns the response so access-denied cases (403) can be asserted. */
  async tryUpload(fileName: string, title: string, content: string) {
    return this.request.post(`${API_URL}/documents/upload`, {
      headers: this.headers,
      multipart: {
        title,
        file: { name: fileName, mimeType: 'text/plain', buffer: Buffer.from(content, 'utf-8') },
      },
    });
  }
}

/** API helper authenticated as another seeded role (one real 2FA login per call). */
export async function apiAs(request: APIRequestContext, role: UserRole): Promise<UatApi> {
  return new UatApi(request, await apiLogin(request, role));
}

type UatTestFixtures = { runId: string; adminApi: UatApi };
type UatWorkerFixtures = { adminToken: string };

export const test = authTest.extend<UatTestFixtures, UatWorkerFixtures>({
  adminToken: [
    async ({ playwright }, use) => {
      const request = await playwright.request.newContext();
      const token = await apiLogin(request, 'tenant_admin');
      await request.dispose();
      await use(token);
    },
    { scope: 'worker' },
  ],

  adminApi: async ({ request, adminToken }, use) => {
    await use(new UatApi(request, adminToken));
  },

  runId: async ({}, use, testInfo) => {
    const stamp = Date.now().toString(36);
    await use(`${stamp}${testInfo.workerIndex}${testInfo.retry}`.toLowerCase());
  },
});

export { expect, TEST_USERS };
