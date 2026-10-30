// frontend/services/resources/workflows.api.ts
//
// Domaine : workflows (étapes, actions, en attente, assignation, stats).
// SRP : change uniquement si le contrat /workflows/* évolue.

import { apiCall } from '../http/client';

// ── DTOs locaux ─────────────────────────────────────────────────────────────

export interface WorkflowActionPayload {
    action_type: string;
    outcome: string;
    document_version_id: string;
    comment?: string;
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

    getPendingWorkflows: (): Promise<any[]> =>
        apiCall<any[]>('/workflows/pending', {}, 'Récupération des workflows en attente impossible'),

    getPendingAssignments: (): Promise<any[]> =>
        apiCall<any[]>('/workflows/pending-assignments', {}, 'Récupération des assignations impossible'),

    validateWorkflowStep: (stepId: string, action: string, comment?: string): Promise<any> =>
        apiCall<any>(
            `/workflows/step/${stepId}/actions`,
            {
                method: 'POST',
                body: JSON.stringify({
                    action_type: action,
                    outcome: action === 'approve' ? 'accepted' : 'rejected',
                    comment,
                }),
            },
            'Validation de l\'étape impossible',
        ),

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
