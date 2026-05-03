// frontend/services/resources/authz.api.ts
//
// Domaine : AuthZ admin — politiques Casbin, rôles, métriques (super_admin).
// SRP : change uniquement si le contrat /authz/* évolue.

import { apiCall } from '../http/client';

// ── DTOs locaux ─────────────────────────────────────────────────────────────

export interface AuthzPolicy {
    ptype?: string;
    v0: string;
    v1: string;
    v2: string;
    v3?: string;
    v4?: string;
    v5?: string;
}

export interface AuthzMetricsFilters {
    decision?: string;
    tenant_id?: string;
    resource?: string;
    action?: string;
    top_n?: number;
}

// ── API ─────────────────────────────────────────────────────────────────────

export const authzApi = {
    getAuthzPolicies: (): Promise<any[]> =>
        apiCall<any[]>('/authz/policies', {}, 'Récupération des politiques impossible'),

    addAuthzPolicy: (policy: AuthzPolicy): Promise<any> =>
        apiCall<any>(
            '/authz/policies',
            { method: 'POST', body: JSON.stringify({ ptype: 'p', ...policy }) },
            'Ajout de la politique impossible',
        ),

    deleteAuthzPolicy: (policy: AuthzPolicy): Promise<any> =>
        apiCall<any>(
            '/authz/policies',
            { method: 'DELETE', body: JSON.stringify({ ptype: 'p', ...policy }) },
            'Suppression de la politique impossible',
        ),

    getAuthzRoles: (): Promise<any[]> =>
        apiCall<any[]>('/authz/roles', {}, 'Récupération des rôles impossible'),

    getAuthzMetrics: (filters: AuthzMetricsFilters = {}): Promise<any> => {
        const p = new URLSearchParams();
        if (filters.decision) p.append('decision', filters.decision);
        if (filters.tenant_id) p.append('tenant_id', filters.tenant_id);
        if (filters.resource) p.append('resource', filters.resource);
        if (filters.action) p.append('action', filters.action);
        if (filters.top_n) p.append('top_n', String(filters.top_n));
        const qs = p.toString();
        return apiCall<any>(`/authz/metrics${qs ? `?${qs}` : ''}`, {}, 'Récupération des métriques impossible');
    },

    getAuthzTopDenies: (
        filters: Omit<AuthzMetricsFilters, 'decision'> = {},
    ): Promise<any> => {
        const p = new URLSearchParams();
        if (filters.tenant_id) p.append('tenant_id', filters.tenant_id);
        if (filters.resource) p.append('resource', filters.resource);
        if (filters.action) p.append('action', filters.action);
        if (filters.top_n) p.append('top_n', String(filters.top_n));
        const qs = p.toString();
        return apiCall<any>(
            `/authz/metrics/top-denies${qs ? `?${qs}` : ''}`,
            {},
            'Récupération des top refus impossible',
        );
    },

    resetAuthzMetrics: (): Promise<any> =>
        apiCall<any>('/authz/metrics/reset', { method: 'POST' }, 'Réinitialisation des métriques impossible'),

    getAuthzHealth: (): Promise<any> =>
        apiCall<any>('/authz/metrics/health', {}, 'Récupération de la santé authz impossible'),
};
