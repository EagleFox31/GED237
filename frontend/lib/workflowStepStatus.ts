import type { WorkflowStep } from '../types';

// Libellés affichés pour l'état d'une étape de circuit (le serveur renvoie des codes anglais).
export const WORKFLOW_STEP_STATUS_LABELS: Record<WorkflowStep['status'], string> = {
  pending: 'En attente',
  current: 'En cours',
  completed: 'Terminée',
  rejected: 'Rejetée',
  returned: 'Renvoyée',
  cancelled: 'Annulée',
  pending_assignment: 'À attribuer',
};

/** Libellé français d'un état d'étape ; un code inconnu donne « État inconnu », jamais le code brut. */
export function workflowStepStatusLabel(status: string | null | undefined): string {
  return (status && WORKFLOW_STEP_STATUS_LABELS[status as WorkflowStep['status']]) || 'État inconnu';
}
