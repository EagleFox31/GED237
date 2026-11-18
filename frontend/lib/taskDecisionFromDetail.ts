// frontend/lib/taskDecisionFromDetail.ts
//
// Helper pur pour les actions « Viser / Rejeter » directement depuis la fiche document
// ouverte depuis le parapheur (`ValidationHub`) ou `WorkflowTasks`.

export interface TaskDecisionActions {
  approveLabel: string;
  onApprove: (detailVersionId?: string | null) => void;
  onReject: (detailVersionId?: string | null) => void;
  disabled?: boolean;
}

export function triggerDetailDecision(
  action: 'approve' | 'reject',
  decision: TaskDecisionActions,
  closeModal: () => void,
  detailVersionId?: string | null,
): void {
  closeModal();
  if (action === 'approve') {
    decision.onApprove(detailVersionId);
  } else {
    decision.onReject(detailVersionId);
  }
}

/**
 * Injecte la version courante de la fiche affichée (celle rechargée par ViewDocumentButton)
 * dans la tâche afin que la décision soit soumise avec la version réellement lue.
 */
export function taskWithDetailVersion<
  T extends { document?: { current_version_id?: string | null } | null },
>(task: T, detailVersionId?: string | null): T {
  const clean = (detailVersionId ?? '').trim();
  if (!clean) return task;
  return {
    ...task,
    document: {
      ...(task.document ?? {}),
      current_version_id: clean,
    },
  };
}
