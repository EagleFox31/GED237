// frontend/services/resources/tenants.api.ts
//
// Domaine : tenants (CRUD, liste publique).
// SRP : change uniquement si le contrat /tenants/* évolue.

import { API_URL } from '../../constants';
import { apiCall } from '../http/client';

// ── DTOs locaux ─────────────────────────────────────────────────────────────

export interface TenantPublic {
    name: string;
    short_name: string | null;
}

export interface TenantPayload {
    name: string;
    short_name?: string;
    domain?: string;
    is_active?: boolean;
}

// ── API ─────────────────────────────────────────────────────────────────────

export const tenantsApi = {
    /**
     * Endpoint public — pas de token, pas de fetchWithRefresh.
     * On utilise fetch directement pour éviter toute boucle de refresh.
     */
    getPublicTenants: async (): Promise<TenantPublic[]> => {
        const response = await fetch(`${API_URL}/tenants/public`);
        if (!response.ok) throw new Error('Récupération des institutions impossible');
        return response.json();
    },

    getTenants: (): Promise<any[]> =>
        apiCall<any[]>('/tenants/', {}, 'Récupération des tenants impossible'),

    getTenant: (tenantId: string): Promise<any> =>
        apiCall<any>(`/tenants/${tenantId}`, {}, 'Récupération du tenant impossible'),

    createTenant: (payload: TenantPayload): Promise<any> =>
        apiCall<any>(
            '/tenants/',
            { method: 'POST', body: JSON.stringify(payload) },
            'Création du tenant impossible',
        ),

    updateTenant: (
        tenantId: string,
        payload: Partial<{ name: string; short_name: string; domain: string; is_active: boolean }>,
    ): Promise<any> =>
        apiCall<any>(
            `/tenants/${tenantId}`,
            { method: 'PATCH', body: JSON.stringify(payload) },
            'Mise à jour du tenant impossible',
        ),
};
