// frontend/services/resources/analytics.api.ts
//
// Domaine : analytics tenant et plateforme.
// SRP : change uniquement si le contrat /analytics/* évolue.

import { apiCall } from '../http/client';

/** Les cartes de tendance affichent leur propre message d'indisponibilité : pas de toast global en plus. */
const TRENDS_HANDLED = [400, 403, 404, 422, 500, 502, 503, 504] as const;

export const analyticsApi = {
    getTenantAnalytics: (): Promise<any> =>
        apiCall<any>('/analytics/tenant', {}, 'Récupération des analytics tenant impossible'),

    getPlatformAnalytics: (): Promise<any> =>
        apiCall<any>('/analytics/platform', {}, 'Récupération des analytics plateforme impossible'),

    getTrends: (scope: 'tenant' | 'unit' | 'mine', weeks = 12): Promise<any> =>
        apiCall<any>(`/analytics/trends?scope=${scope}&weeks=${weeks}`, {}, 'Récupération des tendances impossible', { handledStatuses: TRENDS_HANDLED }),

    getManagerAnalytics: (): Promise<any> =>
        apiCall<any>('/analytics/manager', {}, 'Récupération des analytics du service impossible'),
};
