// frontend/services/resources/imports.api.ts
//
// Domaine : import batch (analyze, commit, lecture job + items).
// SRP : change uniquement si le contrat /imports/* évolue.

import { apiCall } from '../http/client';
import type {
    ImportJobWithItems,
    ImportCommitResponse,
    ImportJob,
    ImportJobItem,
    ImportSourceScope,
    ImportProcessingMode,
} from '../../types';

// ── DTOs locaux ─────────────────────────────────────────────────────────────

export interface AnalyzeImportPayload {
    files: File[];
    sourceScope: ImportSourceScope;
    processingMode: ImportProcessingMode;
    targetOrgUnitId?: string;
    targetUserId?: string;
    defaultDocumentCategoryId?: string;
    forcedYear?: number;
    sourceRelativePaths?: string[];
}

// ── API ─────────────────────────────────────────────────────────────────────

export const importsApi = {
    analyzeImportJob: (payload: AnalyzeImportPayload): Promise<ImportJobWithItems> => {
        const formData = new FormData();
        payload.files.forEach((file) => formData.append('files', file));
        formData.append('source_scope', payload.sourceScope);
        formData.append('processing_mode', payload.processingMode);
        if (payload.targetOrgUnitId) formData.append('target_org_unit_id', payload.targetOrgUnitId);
        if (payload.targetUserId) formData.append('target_user_id', payload.targetUserId);
        if (payload.defaultDocumentCategoryId) {
            formData.append('default_document_category_id', payload.defaultDocumentCategoryId);
        }
        if (typeof payload.forcedYear === 'number' && Number.isFinite(payload.forcedYear)) {
            formData.append('forced_year', String(payload.forcedYear));
        }
        if (payload.sourceRelativePaths?.length) {
            formData.append('source_relative_paths', JSON.stringify(payload.sourceRelativePaths));
        }
        return apiCall<ImportJobWithItems>(
            '/imports/analyze',
            { method: 'POST', body: formData },
            'Analyse du batch impossible',
        );
    },

    commitImportJob: (jobId: string): Promise<ImportCommitResponse> =>
        apiCall<ImportCommitResponse>(
            `/imports/${jobId}/commit`,
            { method: 'POST' },
            'Exécution du batch impossible',
        ),

    getImportJob: (jobId: string): Promise<ImportJob> =>
        apiCall<ImportJob>(`/imports/${jobId}`, {}, 'Lecture du batch impossible'),

    getImportJobItems: (jobId: string, status?: string): Promise<ImportJobItem[]> => {
        const qs = status ? `?status=${encodeURIComponent(status)}` : '';
        return apiCall<ImportJobItem[]>(
            `/imports/${jobId}/items${qs}`,
            {},
            'Lecture des items du batch impossible',
        );
    },
};
