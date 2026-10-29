// frontend/services/resources/audit.api.ts
//
// Domaine : journaux d'audit globaux.
// SRP : change uniquement si le contrat /audit/* évolue.

import { apiCall } from '../http/client';

export const auditApi = {
    getAuditLogs: (
        params: { skip?: number; limit?: number; table_name?: string; action?: string } = {},
    ): Promise<any[]> => {
        const q = new URLSearchParams();
        if (typeof params.skip === 'number') q.append('skip', String(params.skip));
        if (typeof params.limit === 'number') q.append('limit', String(params.limit));
        if (params.table_name) q.append('table_name', params.table_name);
        if (params.action) q.append('action', params.action);
        const qs = q.toString();
        return apiCall<any[]>(
            `/audit/logs${qs ? `?${qs}` : ''}`,
            {},
            'Récupération des journaux d\'audit impossible',
        );
    },
};
