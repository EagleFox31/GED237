// frontend/services/resources/quality.api.ts
//
// Qualité documentaire (#162) et alertes de qualité (#183) : /analytics/quality/*.
// SRP : change uniquement si ce contrat évolue.

import { API_URL } from '../../constants';
import { apiCall, apiCallVoid, fetchWithRefresh, getHeaders } from '../http/client';
import { buildApiError } from '../http/errorAdapter';

export type QualityIndicatorKey =
    | 'missing_metadata'
    | 'missing_category'
    | 'missing_domain'
    | 'missing_year'
    | 'needs_review'
    | 'no_text';

export interface QualityIndicator {
    key: QualityIndicatorKey;
    label: string;
    count: number;
    /** Part des documents du périmètre, en %, ou null s'il n'y en a aucun. */
    rate: number | null;
}

export interface QualitySummary {
    total_documents: number;
    documents_to_fix: number;
    quality_rate: number | null;
    indicators: QualityIndicator[];
}

export interface QualityDocument {
    id: string;
    title: string;
    org_unit_id: string | null;
    status: string;
    classification_status: string;
    created_at: string | null;
}

export type QualityAlertMeasure = 'count' | 'rate';

export interface QualityAlert {
    id: string;
    name: string;
    indicator: QualityIndicatorKey;
    measure: QualityAlertMeasure;
    threshold: number;
    scope: Record<string, unknown>;
    is_active: boolean;
    created_at: string | null;
    /** Renseigné tant que le seuil est atteint. */
    alerting_since: string | null;
}

export interface QualityAlertInput {
    name: string;
    indicator: QualityIndicatorKey;
    measure: QualityAlertMeasure;
    threshold: number;
}

/** Seul refus attendu (409) : les alertes sont coupées sur ce serveur. Texte simple, pas le détail technique. */
export const ALERTS_DISABLED_MESSAGE = 'Les alertes ne sont pas activées.';

/** Création refusée par le serveur (409 : alertes désactivées). */
export type QualityAlertCreateResult = { alert: QualityAlert } | { refused: string };

export const qualityApi = {
    getQualitySummary: () =>
        apiCall<QualitySummary>('/analytics/quality', {}, 'Lecture de la qualité documentaire impossible'),

    getQualityDocuments: async (
        indicator: QualityIndicatorKey,
        { limit = 50, offset = 0 }: { limit?: number; offset?: number } = {},
    ): Promise<{ items: QualityDocument[]; total: number }> => {
        const params = new URLSearchParams({ indicator, limit: String(limit), skip: String(offset) });
        const response = await fetchWithRefresh(`${API_URL}/analytics/quality/documents?${params}`, {
            headers: getHeaders(false),
        });
        if (!response.ok) throw await buildApiError(response, 'Liste des documents à corriger indisponible');
        const items = (await response.json()) as QualityDocument[];
        const header = Number(response.headers.get('X-Total-Count') ?? NaN);
        return { items, total: Number.isInteger(header) && header >= 0 ? header : items.length };
    },

    listQualityAlerts: () =>
        apiCall<QualityAlert[]>('/analytics/quality/alerts', {}, 'Lecture des alertes impossible'),

    createQualityAlert: async (input: QualityAlertInput): Promise<QualityAlertCreateResult> => {
        const response = await fetchWithRefresh(`${API_URL}/analytics/quality/alerts`, {
            method: 'POST',
            headers: getHeaders(false),
            body: JSON.stringify(input),
        });
        // 409 attendu quand le serveur n'autorise pas les alertes : message affiché dans le formulaire, pas en toast.
        if (response.status === 409) {
            return { refused: ALERTS_DISABLED_MESSAGE };
        }
        if (!response.ok) throw await buildApiError(response, 'Création de l’alerte impossible');
        return { alert: (await response.json()) as QualityAlert };
    },

    stopQualityAlert: (id: string) =>
        apiCallVoid(`/analytics/quality/alerts/${id}`, { method: 'DELETE' }, 'Arrêt de l’alerte impossible'),
};
