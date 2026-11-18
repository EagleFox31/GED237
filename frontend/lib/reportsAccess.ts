// Profils qui ont accès aux statistiques (analytics.tenant, read dans backend/app/core/authz/policy.csv) :
// tous sauf le lecteur. Source unique pour la garde de /reports (App.tsx) et les entrées de menu.
export const REPORTS_PROFILES = ['super', 'tenant', 'unit', 'manager', 'collab', 'audit'] as const;

export const canSeeReports = (profileId?: string): boolean =>
  !!profileId && (REPORTS_PROFILES as ReadonlyArray<string>).includes(profileId);
