// frontend/services/resources/classification.api.ts
//
// Domaine : règles de classement — domaines, activités, règles, simulation.
// SRP : change uniquement si le contrat /classification-rules/* évolue.

import { API_URL } from '../../constants';
import { apiCall, apiCallVoid, fetchWithRefresh, getHeaders } from '../http/client';
import { buildApiError } from '../http/errorAdapter';
import type {
    ClassificationDomain,
    ClassificationActivity,
    ClassificationRule,
    ClassificationSimulationResponse,
} from '../../types';

// ── DTOs locaux ─────────────────────────────────────────────────────────────

export type RulesImportMode = 'upsert' | 'create_only';

export interface RulesImportItem {
    code: string;
    action: 'create' | 'update' | 'skip' | 'reject';
    reason?: string | null;
}

export interface RulesImportReport {
    dry_run: boolean;
    /** true seulement si l'écriture a eu lieu (jamais en simulation, jamais si une règle est rejetée). */
    applied: boolean;
    created: number;
    updated: number;
    skipped: number;
    rejected: number;
    items: RulesImportItem[];
}

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
    document_category_ids?: string[] | null;
    source_org_unit_ids?: string[] | null;
    source_org_unit_excluded_ids?: string[] | null;
    source_user_ids?: string[] | null;
    filename_pattern?: string | null;
    mime_type_pattern?: string | null;
    content_pattern?: string | null;
    year_min?: number | null;
    year_max?: number | null;
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

    // ── Export / import des règles ───────────────────────────────────────

    /** Fichier JSON des règles ; le nom vient de Content-Disposition (repli : nom neutre). */
    exportClassificationRules: async (): Promise<{ blob: Blob; filename: string }> => {
        const response = await fetchWithRefresh(`${API_URL}/classification-rules/rules/export`, {
            headers: getHeaders(false),
        });
        if (!response.ok) throw await buildApiError(response, 'Export des règles impossible');
        const disposition = response.headers.get('Content-Disposition') ?? '';
        const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
        return {
            blob: await response.blob(),
            filename: match?.[1] ? decodeURIComponent(match[1]) : 'regles-classement.json',
        };
    },

    /** Simulation (dryRun=true) ou application (dryRun=false) d'un fichier de règles. */
    importClassificationRules: (
        fileContent: unknown,
        options: { dryRun: boolean; mode?: RulesImportMode },
    ): Promise<RulesImportReport> =>
        apiCall<RulesImportReport>(
            `/classification-rules/rules/import?dry_run=${options.dryRun}&mode=${options.mode ?? 'upsert'}`,
            { method: 'POST', body: JSON.stringify(fileContent) },
            "Import des règles impossible",
        ),

    // ── Simulation ────────────────────────────────────────────────────────

    simulateClassification: (payload: {
        document_category_id?: string | null;
        source_scope?: 'person' | 'service' | 'subdirectorate';
        source_org_unit_id?: string | null;
        source_user_id?: string | null;
        filename: string;
        mime_type?: string | null;
        content_sample?: string | null;
    }): Promise<ClassificationSimulationResponse> =>
        apiCall<ClassificationSimulationResponse>(
            '/classification-rules/simulate',
            { method: 'POST', body: JSON.stringify(payload) },
            'Simulation de classement impossible',
        ),
};
