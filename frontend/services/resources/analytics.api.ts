// frontend/services/resources/analytics.api.ts
//
// Domaine : analytics tenant et plateforme.
// SRP : change uniquement si le contrat /analytics/* évolue.

import { apiCall } from '../http/client';

export const analyticsApi = {
    getTenantAnalytics: (): Promise<any> =>
        apiCall<any>('/analytics/tenant', {}, 'Impossible de charger les statistiques.'),

    getPlatformAnalytics: (): Promise<any> =>
        apiCall<any>('/analytics/platform', {}, 'Récupération des analytics plateforme impossible'),
};
