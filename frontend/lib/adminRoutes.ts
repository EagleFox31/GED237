import type { DEFAULT_ROUTE_BY_PROFILE } from './defaultRoute';

type ProfileId = keyof typeof DEFAULT_ROUTE_BY_PROFILE;

// Routes réservées aux administrateurs (liste blanche par profil). Confort d'interface :
// le contrôle d'accès fait foi côté API ; cette table ne doit jamais être plus permissive qu'elle.
// Module à part pour que les écrans (tableau de bord…) la lisent sans importer App.tsx (cycle).
export const ADMIN_ROUTES = {
  '/tenants': ['super'],
  '/tenants/:tenantId': ['super'],
  '/platform-users': ['super'],
  '/authz': ['super'],
  '/org': ['super', 'tenant'],
  '/rules': ['super', 'tenant'],
  '/classement': ['super', 'tenant'],
  '/users': ['super', 'tenant'],
} as const satisfies Record<string, ReadonlyArray<ProfileId>>;

/** Vrai si le profil peut ouvrir la route d'administration (même règle que RequireProfile). */
export const canOpenAdminRoute = (path: keyof typeof ADMIN_ROUTES, profileId: string | undefined): boolean =>
  !!profileId && (ADMIN_ROUTES[path] as ReadonlyArray<string>).includes(profileId);
