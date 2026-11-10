// frontend/services/resources/spaces.api.ts
//
// Domaine : espaces documentaires (arbre + documents).
// SRP : change uniquement si le contrat /spaces/* évolue.

import { API_URL } from '../../constants';
import { apiCall, fetchWithRefresh, getHeaders } from '../http/client';
import { buildApiError } from '../http/errorAdapter';
import type { Document } from '../../types';

// ── DTOs locaux ─────────────────────────────────────────────────────────────

export interface SpaceTreeNode {
    id: string;
    name: string;
    code: string;
    level?: number;
    parent_id?: string | null;
    children?: SpaceTreeNode[];
}

/** Filtres serveur de GET /spaces/documents (contrat Lot C9, #38). Valeur absente = pas de filtre. */
export interface SpaceDocumentFilters {
    orgUnitId?: string;
    recursive?: boolean;
    domainId?: string;
    activityId?: string;
    year?: number;
    status?: string;
    classificationStatus?: string;
    q?: string;
    limit?: number;
    offset?: number;
}

export interface SpaceDocumentsPage {
    items: Document[];
    /** Total après filtres, avant pagination (en-tête X-Total-Count). */
    total: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const orgUnitQuery = (orgUnitId?: string, recursive = false): string => {
    const p = new URLSearchParams();
    if (orgUnitId) p.set('org_unit_id', orgUnitId);
    if (recursive) p.set('recursive', 'true');
    const qs = p.toString();
    return qs ? `?${qs}` : '';
};

const filtersQuery = (f: SpaceDocumentFilters): string => {
    const p = new URLSearchParams();
    if (f.orgUnitId) p.set('org_unit_id', f.orgUnitId);
    if (f.recursive) p.set('recursive', 'true');
    if (f.domainId) p.set('domain_id', f.domainId);
    if (f.activityId) p.set('activity_id', f.activityId);
    if (f.year !== undefined) p.set('year', String(f.year));
    if (f.status) p.set('status', f.status);
    if (f.classificationStatus) p.set('classification_status', f.classificationStatus);
    if (f.q) p.set('q', f.q);
    if (f.limit !== undefined) p.set('limit', String(f.limit));
    if (f.offset !== undefined) p.set('offset', String(f.offset));
    const qs = p.toString();
    return qs ? `?${qs}` : '';
};

// ── API ─────────────────────────────────────────────────────────────────────

export const spacesApi = {
    getSpacesTree: (): Promise<SpaceTreeNode[]> =>
        apiCall<SpaceTreeNode[]>('/spaces/tree', {}, 'Récupération de l\'arbre des espaces impossible'),

    getSpaceDocuments: (orgUnitId?: string, recursive = false): Promise<Document[]> =>
        apiCall<Document[]>(
            `/spaces/documents${orgUnitQuery(orgUnitId, recursive)}`,
            {},
            'Récupération des documents de l\'espace impossible',
        ),

    /** Documents filtrés côté serveur + total (X-Total-Count) ; `signal` annule une requête périmée. */
    getSpaceDocumentsPage: async (
        filters: SpaceDocumentFilters,
        signal?: AbortSignal,
    ): Promise<SpaceDocumentsPage> => {
        const response = await fetchWithRefresh(`${API_URL}/spaces/documents${filtersQuery(filters)}`, {
            headers: getHeaders(false),
            signal,
        });
        if (!response.ok) throw await buildApiError(response, "Récupération des documents de l'espace impossible");
        const items = (await response.json()) as Document[];
        const header = response.headers.get('X-Total-Count');
        const total = header === null ? NaN : Number(header);
        return { items, total: Number.isInteger(total) && total >= 0 ? total : items.length };
    },
};
