// Maquette d'API des captures visuelles : chaque réponse respecte le type du contrat (`satisfies`),
// jamais un `{}` générique qui ferait planter l'écran (LESSON-2026-035).
import type { Page, Route } from '@playwright/test';
import type {
  ClassificationActivity,
  ClassificationDomain,
  ClassificationRule,
  DocumentCategory,
  Tenant,
  TenantMetrics,
} from '../../types';
import type { TenantPublic } from '../../services/resources/tenants.api';
import type { Notification } from '../../hooks/useNotifications';
import type { UserProfile } from '../../stores/authStore';

const TENANT_ID = 'visual-tenant';
const STAMP = '2026-01-15T09:00:00+00:00';

/** Profil tel que `normalizeBackendUser` le stocke pour un tenant_admin. */
export const tenantAdminProfile = {
  id: 'tenant',
  label: 'Admin Tenant',
  role: 'Organisation',
  icon: 'account_balance',
  color: 'bg-rdpc-blue',
  name: 'Admin Visuel',
  backendRole: 'tenant_admin',
  backendRoleLabel: 'Admin Institution',
  matricule: 'VIS001',
  tenantId: TENANT_ID,
  orgUnitId: 'visual-unit',
  mustChangePassword: false,
} satisfies UserProfile;

const publicTenants = [
  { name: 'Ministère des Finances', short_name: 'MINFI' },
  { name: 'Ministère de la Santé publique', short_name: 'MINSANTE' },
] satisfies TenantPublic[];

const tenant = { id: TENANT_ID, name: 'Ministère des Finances', short_name: 'MINFI' } satisfies Tenant;

const tenantMetrics = {
  users: { total: 42 },
  documents: { total: 1280, storage_used_mb: 2048, storage_quota_mb: 10240 },
  workflows: { pending: 7, completed: 135, rejected: 4 },
  duplicates: { refused: 3, refused_upload: 2, refused_import: 1 },
} satisfies TenantMetrics;

const notifications = [] satisfies Notification[];

const domains = [
  {
    id: 'visual-domain-1',
    tenant_id: TENANT_ID,
    code: 'FIN',
    name: 'Finances publiques',
    description: 'Budget, dépenses et recettes',
    is_active: true,
    created_at: STAMP,
    updated_at: STAMP,
  },
] satisfies ClassificationDomain[];

const activities = [] satisfies ClassificationActivity[];
const rules = [] satisfies ClassificationRule[];
const categories = [] satisfies DocumentCategory[];

/** Chemin relatif à `/api/v1` → corps de réponse (GET). Le plus précis d'abord. */
const API_ROUTES: ReadonlyArray<readonly [RegExp, unknown]> = [
  [/^\/tenants\/public$/, publicTenants],
  [/^\/tenants\/[^/]+$/, tenant],
  [/^\/analytics\/tenant$/, tenantMetrics],
  [/^\/notifications\/?$/, notifications],
  [/^\/classification-rules\/domains$/, domains],
  [/^\/classification-rules\/activities$/, activities],
  [/^\/classification-rules\/rules$/, rules],
  [/^\/categories$/, categories],
  [/^\/org-units\/?$/, []],
  [/^\/users\/?$/, []],
  [/^\/gedrules\/templates$/, []],
];

const API_PREFIX = '/api/v1';

/**
 * Branche la maquette sur la page. Renvoie la liste (vivante) des appels non prévus :
 * ils reçoivent un 404 et le test doit vérifier qu'elle reste vide.
 */
export async function mockApi(page: Page): Promise<string[]> {
  const unmocked: string[] = [];

  await page.route(`**${API_PREFIX}/**`, async (route: Route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    const apiPath = pathname.slice(pathname.indexOf(API_PREFIX) + API_PREFIX.length);
    const match = request.method() === 'GET' ? API_ROUTES.find(([pattern]) => pattern.test(apiPath)) : undefined;
    if (match) {
      await route.fulfill({ json: match[1] });
      return;
    }
    unmocked.push(`${request.method()} ${apiPath}`);
    await route.fulfill({ status: 404, json: { detail: 'Not mocked' } });
  });
  await page.route('**/health', (route) => route.fulfill({ json: { status: 'ok' } }));
  // Notifications temps réel : socket simulée, muette.
  await page.routeWebSocket('**/notifications/ws**', () => undefined);

  return unmocked;
}

/** Session tenant_admin sans connexion réelle : mêmes clés que `persistAuthTokens`. */
export async function signInAsTenantAdmin(page: Page): Promise<void> {
  await page.addInitScript((profile) => {
    for (const key of ['access_token', 'refresh_token', 'token']) {
      sessionStorage.setItem(key, 'visual-capture-token');
    }
    sessionStorage.setItem('user_profile', JSON.stringify(profile));
  }, tenantAdminProfile);
}
