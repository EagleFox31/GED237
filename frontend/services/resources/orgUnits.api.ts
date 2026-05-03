// frontend/services/resources/orgUnits.api.ts
//
// Domaine : unités organisationnelles (arbre, liste, types, CRUD).
// SRP : change uniquement si le contrat /org-units/* évolue.

import { apiCall, apiCallVoid } from '../http/client';

// ── DTOs locaux ─────────────────────────────────────────────────────────────

export interface OrgUnitType {
    id: number;
    code: string;
    label: string;
    level: number;
}

// ── API ─────────────────────────────────────────────────────────────────────

export const orgUnitsApi = {
    getOrgUnitsTree: (): Promise<any> =>
        apiCall<any>('/org-units/tree', {}, 'Récupération de l\'arbre organisationnel impossible'),

    getOrgUnitsTreeForTenant: (tenantId: string): Promise<any> =>
        apiCall<any>(
            `/org-units/tree?tenant_id=${tenantId}`,
            {},
            'Récupération de l\'arbre organisationnel pour ce tenant impossible',
        ),

    getOrgUnits: (): Promise<any[]> =>
        apiCall<any[]>('/org-units', {}, 'Récupération des services impossible'),

    getOrgUnitTypes: (): Promise<OrgUnitType[]> =>
        apiCall<OrgUnitType[]>('/org-units/types', {}, 'Récupération des types d\'unité impossible'),

    getOrgUnitsForTenant: (tenantId: string): Promise<any[]> =>
        apiCall<any[]>(
            `/org-units?tenant_id=${tenantId}`,
            {},
            'Récupération des unités pour ce tenant impossible',
        ),

    createOrgUnit: (data: any): Promise<any> =>
        apiCall<any>(
            '/org-units',
            { method: 'POST', body: JSON.stringify(data) },
            'Création du service impossible',
        ),

    updateOrgUnit: (id: string, data: any): Promise<any> =>
        apiCall<any>(
            `/org-units/${id}`,
            { method: 'PATCH', body: JSON.stringify(data) },
            'Mise à jour du service impossible',
        ),

    deleteOrgUnit: async (id: string): Promise<true> => {
        await apiCallVoid(`/org-units/${id}`, { method: 'DELETE' }, 'Suppression du service impossible');
        return true;
    },
};
