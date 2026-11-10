// frontend/services/resources/audit.api.ts
//
// Domaine : journaux d'audit globaux.
// SRP : change uniquement si le contrat /audit/* évolue.

import { API_URL } from '../../constants';
import { apiCall, fetchWithRefresh, getHeaders } from '../http/client';
import { buildApiError } from '../http/errorAdapter';

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

    /**
     * Export CSV du journal (Excel FR : BOM, séparateur « ; »). `table_name` et `action` peuvent
     * être répétés ; dates AAAA-MM-JJ. 422 au-delà de 50 000 lignes : le message du serveur
     * est affiché par le bus d'erreurs global.
     */
    exportAuditLogs: async (
        params: {
            table_name?: string[];
            action?: string[];
            user_id?: string;
            date_from?: string;
            date_to?: string;
        } = {},
    ): Promise<{ blob: Blob; filename: string }> => {
        // Les listes sont envoyées en paramètres répétés (?action=a&action=b).
        const q = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (Array.isArray(value)) value.forEach((v) => v && q.append(key, v));
            else if (value) q.append(key, value);
        });
        const qs = q.toString();
        const response = await fetchWithRefresh(`${API_URL}/audit/logs/export${qs ? `?${qs}` : ''}`, {
            headers: getHeaders(false),
        });
        if (!response.ok) throw await buildApiError(response, "Export du journal d'audit impossible");
        const disposition = response.headers.get('Content-Disposition') ?? '';
        const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
        return {
            blob: await response.blob(),
            filename: match?.[1] ? decodeURIComponent(match[1]) : 'journal-audit.csv',
        };
    },
};
