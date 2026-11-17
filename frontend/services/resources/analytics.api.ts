// frontend/services/resources/analytics.api.ts
//
// Domaine : analytics tenant et plateforme.
// SRP : change uniquement si le contrat /analytics/* évolue.

import { apiCall } from '../http/client';
import type { ManagerMetrics } from '../../lib/managerDashboard';

export const analyticsApi = {
    // Tuiles du manager (#278) : l'écran affiche lui-même 403 (rien) et les autres échecs.
    getManagerAnalytics: (): Promise<ManagerMetrics> =>
        apiCall<ManagerMetrics>('/analytics/manager', {}, 'Chiffres indisponibles pour le moment.', {
            handledStatuses: [403, 404, 500, 502, 503, 504],
        }),

    getTenantAnalytics: (): Promise<any> =>
        apiCall<any>('/analytics/tenant', {}, 'Récupération des analytics tenant impossible'),

    getPlatformAnalytics: (): Promise<any> =>
        apiCall<any>('/analytics/platform', {}, 'Récupération des analytics plateforme impossible'),
};
