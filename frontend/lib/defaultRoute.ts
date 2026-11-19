// Page d'accueil de chaque profil (utilisée après connexion et après changement de mot de passe).
export const DEFAULT_ROUTE_BY_PROFILE: Record<string, string> = {
  super: '/tenants',
  tenant: '/dashboard',
  unit: '/dashboard',
  manager: '/tasks',
  collab: '/dashboard',
  reader: '/documents',
  audit: '/audit',
};

export const defaultRouteForProfile = (profileId?: string): string =>
  (profileId && DEFAULT_ROUTE_BY_PROFILE[profileId]) || '/dashboard';
