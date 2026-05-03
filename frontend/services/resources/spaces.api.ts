// frontend/services/resources/spaces.api.ts
//
// Domaine : espaces documentaires (arbre + documents).
// SRP : change uniquement si le contrat /spaces/* évolue.

import { apiCall } from '../http/client';
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

// ── Helpers ──────────────────────────────────────────────────────────────────

const orgUnitQuery = (orgUnitId?: string, recursive = false): string => {
    const p = new URLSearchParams();
    if (orgUnitId) p.set('org_unit_id', orgUnitId);
    if (recursive) p.set('recursive', 'true');
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
};
