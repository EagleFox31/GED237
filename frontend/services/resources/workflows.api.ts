// frontend/services/resources/workflows.api.ts
//
// Domaine : workflows (étapes, actions, en attente, assignation, stats).
// SRP : change uniquement si le contrat /workflows/* évolue.

import { apiCall } from '../http/client';
import type { PendingWorkflowTask, WorkflowValidator } from '../../types';

// ── DTOs locaux ─────────────────────────────────────────────────────────────

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
