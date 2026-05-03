// frontend/services/resources/classification.api.ts
//
// Domaine : règles de classement — domaines, activités, règles, simulation.
// SRP : change uniquement si le contrat /classification-rules/* évolue.

import { apiCall, apiCallVoid } from '../http/client';
import type {
    ClassificationDomain,
    ClassificationActivity,
    ClassificationRule,
    ClassificationSimulationResponse,
} from '../../types';

// ── DTOs locaux ─────────────────────────────────────────────────────────────

export interface ClassificationDomainPayload {
    code: string;
    name: string;
    description?: string | null;
    is_active?: boolean;
}

export interface ClassificationActivityPayload {
    domain_id: string;
    code: string;
    name: string;
    description?: string | null;
    is_active?: boolean;
}

export interface ClassificationRulePayload {
    code: string;
    name: string;
    description?: string | null;
    priority?: number;
    is_active?: boolean;
    source_scope: 'person' | 'service' | 'subdirectorate';
    source_org_unit_id?: string | null;
    source_user_id?: string | null;
    document_category_id?: string | null;
    filename_pattern?: string | null;
    mime_type_pattern?: string | null;
    target_scope: 'person' | 'service' | 'subdirectorate' | 'directorate';
    target_org_unit_id?: string | null;
    target_user_id?: string | null;
    domain_id?: string | null;
    activity_id?: string | null;
    year_strategy?: 'current' | 'from_filename' | 'from_metadata' | 'fixed';
    fixed_year?: number | null;
    workflow_template_id?: string | null;
}

// ── API ─────────────────────────────────────────────────────────────────────

export const classificationApi = {
    // ── Domaines ──────────────────────────────────────────────────────────

    getClassificationDomains: (includeInactive = false): Promise<ClassificationDomain[]> => {
        const qs = includeInactive ? '?include_inactive=true' : '';
        return apiCall<ClassificationDomain[]>(
            `/classification-rules/domains${qs}`,
            {},
            'Récupération des domaines impossible',
        );
    },

    createClassificationDomain: (data: ClassificationDomainPayload): Promise<ClassificationDomain> =>
        apiCall<ClassificationDomain>(
            '/classification-rules/domains',
            { method: 'POST', body: JSON.stringify(data) },
            'Création du domaine impossible',
        ),

    updateClassificationDomain: (
        id: string,
        data: Partial<ClassificationDomainPayload>,
    ): Promise<ClassificationDomain> =>
        apiCall<ClassificationDomain>(
            `/classification-rules/domains/${id}`,
            { method: 'PATCH', body: JSON.stringify(data) },
            'Mise à jour du domaine impossible',
        ),

    deleteClassificationDomain: async (id: string): Promise<true> => {
        await apiCallVoid(
            `/classification-rules/domains/${id}`,
            { method: 'DELETE' },
            'Suppression du domaine impossible',
        );
        return true;
    },

    // ── Activités ─────────────────────────────────────────────────────────

    getClassificationActivities: (
        params: { domainId?: string; includeInactive?: boolean } = {},
    ): Promise<ClassificationActivity[]> => {
        const q = new URLSearchParams();
        if (params.domainId) q.set('domain_id', params.domainId);
        if (params.includeInactive) q.set('include_inactive', 'true');
        const qs = q.toString() ? `?${q.toString()}` : '';
        return apiCall<ClassificationActivity[]>(
            `/classification-rules/activities${qs}`,
            {},
            'Récupération des activités impossible',
        );
    },

    createClassificationActivity: (data: ClassificationActivityPayload): Promise<ClassificationActivity> =>
        apiCall<ClassificationActivity>(
            '/classification-rules/activities',
            { method: 'POST', body: JSON.stringify(data) },
            'Création de l\'activité impossible',
        ),

    updateClassificationActivity: (
        id: string,
        data: Partial<ClassificationActivityPayload>,
    ): Promise<ClassificationActivity> =>
        apiCall<ClassificationActivity>(
            `/classification-rules/activities/${id}`,
            { method: 'PATCH', body: JSON.stringify(data) },
            'Mise à jour de l\'activité impossible',
        ),

    deleteClassificationActivity: async (id: string): Promise<true> => {
        await apiCallVoid(
            `/classification-rules/activities/${id}`,
            { method: 'DELETE' },
            'Suppression de l\'activité impossible',
        );
        return true;
    },

    // ── Règles ────────────────────────────────────────────────────────────

    getClassificationRules: (): Promise<ClassificationRule[]> =>
        apiCall<ClassificationRule[]>(
            '/classification-rules/rules',
            {},
            'Récupération des règles de classement impossible',
        ),

    getClassificationRule: (id: string): Promise<ClassificationRule> =>
        apiCall<ClassificationRule>(
            `/classification-rules/rules/${id}`,
            {},
            'Lecture de la règle impossible',
        ),

    createClassificationRule: (data: ClassificationRulePayload): Promise<ClassificationRule> =>
        apiCall<ClassificationRule>(
            '/classification-rules/rules',
            { method: 'POST', body: JSON.stringify(data) },
            'Création de la règle impossible',
        ),

    updateClassificationRule: (
        id: string,
        data: Partial<ClassificationRulePayload>,
    ): Promise<ClassificationRule> =>
        apiCall<ClassificationRule>(
            `/classification-rules/rules/${id}`,
            { method: 'PATCH', body: JSON.stringify(data) },
            'Mise à jour de la règle impossible',
        ),

    deleteClassificationRule: async (id: string): Promise<true> => {
        await apiCallVoid(
            `/classification-rules/rules/${id}`,
            { method: 'DELETE' },
            'Suppression de la règle impossible',
        );
        return true;
    },

    // ── Simulation ────────────────────────────────────────────────────────

    simulateClassification: (payload: {
        document_category_id?: string | null;
        source_scope?: 'person' | 'service' | 'subdirectorate';
        source_org_unit_id?: string | null;
        source_user_id?: string | null;
        filename: string;
        mime_type?: string | null;
    }): Promise<ClassificationSimulationResponse> =>
        apiCall<ClassificationSimulationResponse>(
            '/classification-rules/simulate',
            { method: 'POST', body: JSON.stringify(payload) },
            'Simulation de classement impossible',
        ),
};
