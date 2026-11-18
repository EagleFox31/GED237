// frontend/lib/taskDecisionFromDetail.ts
//
// Helper pur pour les actions « Viser / Rejeter » directement depuis la fiche document
// ouverte depuis le parapheur (`ValidationHub`) ou `WorkflowTasks`.

export interface TaskDecisionActions {
  approveLabel: string;
  onApprove: () => void;
  onReject: () => void;
  disabled?: boolean;
}

export function triggerDetailDecision(
  action: 'approve' | 'reject',
  decision: TaskDecisionActions,
  closeModal: () => void,
): void {
  closeModal();
  if (action === 'approve') {
    decision.onApprove();
  } else {
    decision.onReject();
  }
}
