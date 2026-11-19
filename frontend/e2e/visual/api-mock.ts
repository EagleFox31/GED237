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
import type { BackendUser } from '../../services/resources/auth.api';

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

const users = [] satisfies BackendUser[];
// Services encore typés `any[]` (org-units, gedrules) : une liste vide reste valable quel que soit le contrat.
const untypedEmptyList: readonly unknown[] = [];

/** Une route de la maquette : chemin relatif à `/api/v1` → corps de la réponse GET, du type annoncé. */
export interface ApiRoute<T = unknown> {
  readonly pattern: RegExp;
  readonly body: T;
}

const apiRoute = <T>(pattern: RegExp, body: T): ApiRoute<T> => ({ pattern, body });

/** Le plus précis d'abord. */
export const API_ROUTES: readonly ApiRoute[] = [
  apiRoute<TenantPublic[]>(/^\/tenants\/public$/, publicTenants),
  apiRoute<Tenant>(/^\/tenants\/[^/]+$/, tenant),
  apiRoute<TenantMetrics>(/^\/analytics\/tenant$/, tenantMetrics),
  apiRoute<Notification[]>(/^\/notifications\/?$/, notifications),
  apiRoute<ClassificationDomain[]>(/^\/classification-rules\/domains$/, domains),
  apiRoute<ClassificationActivity[]>(/^\/classification-rules\/activities$/, activities),
  apiRoute<ClassificationRule[]>(/^\/classification-rules\/rules$/, rules),
  apiRoute<DocumentCategory[]>(/^\/categories$/, categories),
  apiRoute<BackendUser[]>(/^\/users\/?$/, users),
  apiRoute(/^\/org-units\/?$/, untypedEmptyList),
  apiRoute(/^\/gedrules\/templates$/, untypedEmptyList),
];

const API_PREFIX = '/api/v1';

export interface MockApiOptions {
  /** Chemins (relatifs à `/api/v1`) dont la route est retirée : sert à prouver la garde. */
  readonly omit?: readonly string[];
}

/**
 * Branche la maquette sur la page. Renvoie la liste (vivante) des appels non prévus :
 * ils reçoivent un 404 et le test doit vérifier qu'elle reste vide.
 */
export async function mockApi(page: Page, { omit = [] }: MockApiOptions = {}): Promise<string[]> {
  const unmocked: string[] = [];
  const routes = API_ROUTES.filter(({ pattern }) => !omit.some((path) => pattern.test(path)));

  await page.route(`**${API_PREFIX}/**`, async (route: Route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    const apiPath = pathname.slice(pathname.indexOf(API_PREFIX) + API_PREFIX.length);
    const match = request.method() === 'GET' ? routes.find(({ pattern }) => pattern.test(apiPath)) : undefined;
    if (match) {
      await route.fulfill({ json: match.body });
      return;
    }
    unmocked.push(`${request.method()} ${apiPath}`);
    await route.fulfill({ status: 404, json: { detail: 'Not mocked' } });
  });
  await page.route('**/health', (route) => route.fulfill({ json: { status: 'ok' } }));
  // Notifications temps réel : ticket simulé, puis socket simulée, muette.
  await page.route(`**${API_PREFIX}/auth/ws-ticket`, (route) =>
    route.fulfill({ json: { ticket: 'visual-ticket', expires_in: 30 } }),
  );
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
