// frontend/services/resources/gedrules.api.ts
//
// Domaine : GED Rules — templates de routage, règles, simulation.
// SRP : change uniquement si le contrat /gedrules/* évolue.

import { apiCall, apiCallVoid } from '../http/client';

// ── API ─────────────────────────────────────────────────────────────────────

export const gedrulesApi = {
    // ── Templates ─────────────────────────────────────────────────────────

    getTemplates: (): Promise<any[]> =>
        apiCall<any[]>('/gedrules/templates', {}, 'Récupération des templates impossible'),

    createTemplate: (data: any): Promise<any> =>
        apiCall<any>(
            '/gedrules/templates',
            { method: 'POST', body: JSON.stringify(data) },
            'Création du template impossible',
        ),

    updateTemplate: (id: string, data: any): Promise<any> =>
        apiCall<any>(
            `/gedrules/templates/${id}`,
            { method: 'PUT', body: JSON.stringify(data) },
            'Mise à jour du template impossible',
        ),

    deleteTemplate: async (id: string): Promise<true> => {
        await apiCallVoid(
            `/gedrules/templates/${id}`,
            { method: 'DELETE' },
            'Suppression du template impossible',
        );
        return true;
    },

    // ── Routing Rules ──────────────────────────────────────────────────────

    getRoutingRules: (): Promise<any[]> =>
        apiCall<any[]>('/gedrules/rules', {}, 'Récupération des règles impossible'),

    createRoutingRule: (data: any): Promise<any> =>
        apiCall<any>(
            '/gedrules/rules',
            { method: 'POST', body: JSON.stringify(data) },
            'Création de la règle impossible',
        ),

    updateRoutingRule: (id: string, data: any): Promise<any> =>
        apiCall<any>(
            `/gedrules/rules/${id}`,
            { method: 'PUT', body: JSON.stringify(data) },
            'Mise à jour de la règle impossible',
        ),

    deleteRoutingRule: async (id: string): Promise<true> => {
        await apiCallVoid(
            `/gedrules/rules/${id}`,
            { method: 'DELETE' },
            'Suppression de la règle impossible',
        );
        return true;
    },

    // ── Simulation ────────────────────────────────────────────────────────

    simulateRouting: (payload: {
        document_category_id: string;
        org_unit_id: string | null;
        owner_id?: string | null;
    }): Promise<any> =>
        apiCall<any>(
            '/gedrules/simulate',
            { method: 'POST', body: JSON.stringify(payload) },
            'Simulation de routage impossible',
        ),
};
