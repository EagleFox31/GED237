// frontend/services/resources/documents.api.ts
//
// Domaine : documents (CRUD, versions, workspace, needs-review, reviews,
//           audit logs, ingestion répertoire, démarrage workflow).
// SRP : change uniquement si le contrat /documents/* ou /classification-reviews/* évolue.

import { apiCall, apiCallVoid, apiCallBlob } from '../http/client';
import type {
    Document,
    ClassificationReview,
    ResolveClassificationReviewPayload,
    ResolveClassificationReviewResponse,
} from '../../types';

// ── DTOs locaux ─────────────────────────────────────────────────────────────

export interface ResolveReviewPayload {
    target_folder_id: string;
    document_category_id?: string;
    comment?: string;
    resolution_reason?: string;
    new_filename?: string;
    mark_as_resolved: boolean;
    create_rule_suggestion?: boolean;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const orgUnitQuery = (orgUnitId?: string, recursive = false): string => {
    const p = new URLSearchParams();
    if (orgUnitId) p.set('org_unit_id', orgUnitId);
    if (recursive) p.set('recursive', 'true');
    const qs = p.toString();
    return qs ? `?${qs}` : '';
};

// ── API ─────────────────────────────────────────────────────────────────────

export const documentsApi = {
    // ── CRUD ──────────────────────────────────────────────────────────────

    uploadDocument: (formData: FormData): Promise<Document> =>
        apiCall<Document>(
            '/documents/upload',
            { method: 'POST', body: formData },
            'Upload du document impossible',
        ),

    getDocuments: (params: { status?: string; skip?: number; limit?: number } = {}): Promise<Document[]> => {
        const q = new URLSearchParams();
        if (params.status) q.append('status', params.status);
        if (typeof params.skip === 'number') q.append('skip', String(params.skip));
        if (typeof params.limit === 'number') q.append('limit', String(params.limit));
        const qs = q.toString();
        return apiCall<Document[]>(
            `/documents${qs ? `?${qs}` : ''}`,
            {},
            'Récupération des documents impossible',
        );
    },

    getDocument: (id: string): Promise<Document> =>
        apiCall<Document>(`/documents/${id}`, {}, 'Lecture du document impossible'),

    /**
     * Récupère le contenu binaire d'un document avec authentification (JWT).
     * - disposition='inline' (défaut) : pour <iframe>/<img> via URL.createObjectURL
     * - disposition='attachment' : force le téléchargement (Content-Disposition attachment)
     * Le caller est responsable d'appeler URL.revokeObjectURL au démontage pour
     * éviter les fuites mémoire.
     */
    getDocumentContentBlob: (
        id: string,
        disposition: 'inline' | 'attachment' = 'inline',
    ): Promise<Blob> =>
        apiCallBlob(
            `/documents/${id}/content?disposition=${disposition}`,
            {},
            'Téléchargement du contenu impossible',
        ),

    updateDocument: (id: string, data: Partial<Document>): Promise<Document> =>
        apiCall<Document>(
            `/documents/${id}`,
            { method: 'PATCH', body: JSON.stringify(data) },
            'Mise à jour du document impossible',
        ),

    deleteDocument: async (id: string): Promise<true> => {
        await apiCallVoid(`/documents/${id}`, { method: 'DELETE' }, 'Suppression du document impossible');
        return true;
    },

    // ── Versions ──────────────────────────────────────────────────────────

    getDocumentVersions: (id: string): Promise<any[]> =>
        apiCall<any[]>(`/documents/${id}/versions`, {}, 'Récupération des versions impossible'),

    // ── Stats ─────────────────────────────────────────────────────────────

    getDocumentStats: (tenantId?: string): Promise<any> => {
        const qs = tenantId ? `?tenant_id=${tenantId}` : '';
        return apiCall<any>(`/documents/stats${qs}`, {}, 'Récupération des statistiques impossible');
    },

    // ── Workspace / Spaces ────────────────────────────────────────────────

    getWorkspaceDocuments: (orgUnitId?: string, recursive = false): Promise<Document[]> =>
        apiCall<Document[]>(
            `/documents/workspace${orgUnitQuery(orgUnitId, recursive)}`,
            {},
            'Récupération du workspace impossible',
        ),

    // ── Needs Review & Classification Reviews ─────────────────────────────

    // any[] : surface réelle plus riche que Document (suggested_rule, arbitration_reason…).
    // Les consommateurs raffinent vers leur propre sous-type local.
    getNeedsReviewDocuments: (): Promise<any[]> =>
        apiCall<any[]>('/documents/needs-review', {}, 'Récupération des documents en revue impossible'),

    getClassificationReviews: (): Promise<ClassificationReview[]> =>
        apiCall<ClassificationReview[]>('/classification-reviews', {}, 'Récupération des revues impossible'),

    // payload: any (au lieu de ResolveReviewPayload strict) — les consommateurs
    // construisent souvent un sous-ensemble (target_folder_id optionnel selon le cas).
    resolveReview: (id: string, payload: any): Promise<any> =>
        apiCall<any>(
            `/documents/${id}/resolve-review`,
            { method: 'POST', body: JSON.stringify(payload) },
            'Résolution de la revue impossible',
        ),

    resolveClassificationReview: (
        id: string,
        payload: ResolveClassificationReviewPayload,
    ): Promise<ResolveClassificationReviewResponse> =>
        apiCall<ResolveClassificationReviewResponse>(
            `/classification-reviews/${id}/resolve`,
            { method: 'POST', body: JSON.stringify(payload) },
            'Résolution de la revue de classement impossible',
        ),

    // ── Audit logs par document ───────────────────────────────────────────

    getDocumentAuditLogs: (id: string): Promise<any[]> =>
        apiCall<any[]>(`/documents/${id}/audit-logs`, {}, 'Récupération des logs impossible'),

    // ── Ingestion répertoire ──────────────────────────────────────────────

    ingestDirectory: (
        directoryPath: string,
        recursive = true,
        documentCategoryId?: string,
        processingMode: 'archive' | 'process' = 'process',
    ): Promise<any> =>
        apiCall<any>(
            '/documents/ingest-directory',
            {
                method: 'POST',
                body: JSON.stringify({
                    directory_path: directoryPath,
                    recursive,
                    document_category_id: documentCategoryId ?? null,
                    processing_mode: processingMode,
                }),
            },
            'Ingestion du répertoire impossible',
        ),

    // ── Démarrage workflow ────────────────────────────────────────────────

    startDocumentWorkflow: (documentId: string): Promise<any> =>
        apiCall<any>(
            `/documents/${documentId}/start-workflow`,
            { method: 'POST' },
            'Lancement du circuit impossible',
        ),
};
