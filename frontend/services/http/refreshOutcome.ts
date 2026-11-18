// Décision après l'appel de renouvellement de session (POST /auth/refresh).
// Pur, sans navigateur : testé par e2e/unit/refresh-outcome.spec.ts.
//
// - renewed   : nouveaux jetons, on rejoue la requête d'origine.
// - expired   : le serveur refuse le jeton (401/403) → déconnexion avec message.
// - transient : pas de réponse (réseau, délai) ou erreur serveur (429, 5xx) → la session est gardée,
//               l'erreur s'affiche et la prochaine action retente le renouvellement.
export type RefreshOutcome = 'renewed' | 'expired' | 'transient';

/** `status` = statut HTTP de /auth/refresh, ou null si aucune réponse n'est arrivée. */
export const refreshOutcome = (status: number | null): RefreshOutcome => {
    if (status === null) return 'transient';
    if (status >= 200 && status < 300) return 'renewed';
    if (status === 401 || status === 403) return 'expired';
    return 'transient';
};
