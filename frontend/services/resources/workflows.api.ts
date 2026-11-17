// frontend/services/resources/workflows.api.ts
//
// Domaine : workflows (étapes, actions, en attente, assignation, stats).
// SRP : change uniquement si le contrat /workflows/* évolue.

import { API_URL } from '../../constants';
import { apiCall, fetchWithRefresh, getHeaders } from '../http/client';
import { buildApiError } from '../http/errorAdapter';
import type { PendingWorkflowTask, WorkflowValidator } from '../../types';

// ── DTOs locaux ─────────────────────────────────────────────────────────────

/** Files de GET /workflows/inbox : mes étapes, celles de mon unité, celles sans validateur. */
export type InboxScope = 'mine' | 'unit' | 'unassigned';

export interface InboxQuery {
    scope: InboxScope;
    /** Portée `unit` : inclure les unités filles. */
    recursive?: boolean;
    limit?: number;
    offset?: number;
}

export interface InboxPage {
    items: PendingWorkflowTask[];
    total: number;
}

export interface WorkflowActionPayload {
    action_type: string;
    outcome: string;
    document_version_id: string;
    comment?: string;
}

/** Décision d'un valideur sur sa tâche : accepter (viser, approuver, signer, prendre connaissance) ou rejeter. */
export type WorkflowDecision = 'accept' | 'reject';

/**
 * Construit le corps de POST /workflows/step/{id}/actions à partir d'une tâche de /pending.
 * action_type reprend l'action attendue par l'étape ; la version citée est la version courante
 * du document (le backend refuse toute autre version). Lève une erreur si la tâche n'en porte pas.
 */
export function buildWorkflowDecision(
    task: Pick<PendingWorkflowTask, 'expected_action_type' | 'document'>,
    decision: WorkflowDecision,
    comment?: string,
): WorkflowActionPayload {
    const versionId = task.document?.current_version_id;
    if (!versionId) {
        throw new Error("Ce document n'a pas de version à valider. Rechargez la page.");
    }
    const actionType = task.expected_action_type || 'visa';
    const outcome = decision === 'reject'
        ? 'rejected'
        : actionType === 'read_ack' ? 'acknowledged' : 'accepted';
    const trimmed = comment?.trim();
    return {
        action_type: actionType,
        outcome,
        document_version_id: versionId,
        ...(trimmed ? { comment: trimmed } : {}),
    };
}

// ── API ─────────────────────────────────────────────────────────────────────

export const workflowsApi = {
    createWorkflowSteps: (documentId: string, steps: any[]): Promise<any> =>
        apiCall<any>(
            `/workflows/document/${documentId}/steps`,
            { method: 'POST', body: JSON.stringify(steps) },
            'Création des étapes de workflow impossible',
        ),

    getWorkflowSteps: (documentId: string): Promise<any[]> =>
        apiCall<any[]>(
            `/workflows/document/${documentId}/steps`,
            {},
            'Récupération des étapes impossible',
        ),

    getWorkflowActions: (documentId: string): Promise<any[]> =>
        apiCall<any[]>(
            `/workflows/document/${documentId}/actions`,
            {},
            'Récupération de l\'historique des actions impossible',
        ),

    getPendingWorkflows: (): Promise<PendingWorkflowTask[]> =>
        apiCall<PendingWorkflowTask[]>('/workflows/pending', {}, 'Récupération des workflows en attente impossible'),

    getWorkflowValidators: (): Promise<WorkflowValidator[]> =>
        apiCall<WorkflowValidator[]>('/workflows/validators', {}, 'Récupération des valideurs impossible'),

    /**
     * File de validation unifiée. `null` quand le serveur ne la propose pas encore
     * (404 tant que WORKFLOW_INBOX_ENABLED=false) : l'appelant reprend alors les anciennes
     * routes. Ce 404 attendu ne passe pas par le bus d'erreurs.
     */
    getWorkflowInbox: async ({ scope, recursive = false, limit = 50, offset = 0 }: InboxQuery): Promise<InboxPage | null> => {
        const params = new URLSearchParams({ scope, recursive: String(recursive), limit: String(limit), offset: String(offset) });
        const response = await fetchWithRefresh(`${API_URL}/workflows/inbox?${params}`, { headers: getHeaders(false) });
        if (response.status === 404) return null;
        if (!response.ok) throw await buildApiError(response, 'Récupération de la file de validation impossible');
        const items = (await response.json()) as PendingWorkflowTask[];
        const header = Number(response.headers.get('X-Total-Count') ?? NaN);
        return { items, total: Number.isInteger(header) && header >= 0 ? header : items.length };
    },

    getPendingAssignments: (): Promise<any[]> =>
        apiCall<any[]>('/workflows/pending-assignments', {}, 'Récupération des assignations impossible'),

    decideWorkflowStep: (
        task: PendingWorkflowTask,
        decision: WorkflowDecision,
        comment?: string,
    ): Promise<any> =>
        workflowsApi.submitWorkflowAction(task.id, buildWorkflowDecision(task, decision, comment)),

    submitWorkflowAction: (stepId: string, payload: WorkflowActionPayload): Promise<any> =>
        apiCall<any>(
            `/workflows/step/${stepId}/actions`,
            { method: 'POST', body: JSON.stringify(payload) },
            'Soumission de l\'action impossible',
        ),

    assignPendingStep: (stepId: string, assignedTo: string): Promise<any> =>
        apiCall<any>(
            `/workflows/steps/${stepId}/assign`,
            { method: 'POST', body: JSON.stringify({ assigned_to: assignedTo }) },
            'Assignation de l\'étape impossible',
        ),

    getWorkflowStats: (tenantId?: string): Promise<any> => {
        const qs = tenantId ? `?tenant_id=${tenantId}` : '';
        return apiCall<any>(`/workflows/stats${qs}`, {}, 'Récupération des statistiques workflow impossible');
    },
};
