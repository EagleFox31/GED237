// frontend/lib/workflowBatch.ts
//
// Logique pure pour le filtrage par type d'action et la prise de connaissance groupée (`read_ack` uniquement).

export type TaskActionFilter = 'all' | 'read_ack' | 'visa' | 'approval' | 'final_signature';

export const BATCH_READ_ACK_COMMENT = 'Prise de connaissance groupée';

export interface BatchableTask {
  id: string;
  expected_action_type?: string | null;
}

export function filterTasksByActionType<T extends BatchableTask>(
  tasks: ReadonlyArray<T>,
  filter: TaskActionFilter,
): T[] {
  if (filter === 'all') return [...tasks];
  return tasks.filter((t) => t.expected_action_type === filter);
}

export function countTasksByActionType<T extends BatchableTask>(
  tasks: ReadonlyArray<T>,
): Record<TaskActionFilter, number> {
  const counts: Record<TaskActionFilter, number> = {
    all: tasks.length,
    read_ack: 0,
    visa: 0,
    approval: 0,
    final_signature: 0,
  };
  for (const t of tasks) {
    const type = t.expected_action_type;
    if (type === 'read_ack' || type === 'visa' || type === 'approval' || type === 'final_signature') {
      counts[type] += 1;
    }
  }
  return counts;
}

/**
 * La prise de connaissance groupée n'est autorisée QUE lorsque le filtre
 * « Prises de connaissance » (`read_ack`) est actif et qu'au moins une tâche est affichée.
 */
export function isBatchReadAckAvailable<T extends BatchableTask>(
  filter: TaskActionFilter,
  visibleTasks: ReadonlyArray<T>,
): boolean {
  return (
    filter === 'read_ack' &&
    visibleTasks.length > 0 &&
    visibleTasks.every((t) => t.expected_action_type === 'read_ack')
  );
}

export interface BatchReadAckResult {
  succeededIds: string[];
  failedCount: number;
}

/**
 * Formate le bilan de fin de lot (réussites et échecs).
 */
export function formatBatchReadAckSummary(
  succeededCount: number,
  failedCount: number,
): string {
  const okLabel =
    succeededCount <= 1
      ? `${succeededCount} prise de connaissance enregistrée`
      : `${succeededCount} prises de connaissance enregistrées`;
  if (failedCount <= 0) {
    return `${okLabel}.`;
  }
  const errLabel = failedCount === 1 ? '1 échouée' : `${failedCount} échouées`;
  return `${okLabel}, ${errLabel}.`;
}

/**
 * Exécute un appel API individuel par tâche `read_ack` (une trace d'audit par document)
 * avec le commentaire fixe « Prise de connaissance groupée ».
 * Si une tâche échoue, les autres continuent et le compteur d'échecs est remonté.
 */
export async function executeBatchReadAck<T extends BatchableTask>(
  tasks: ReadonlyArray<T>,
  decideOne: (task: T, comment: string) => Promise<unknown>,
): Promise<BatchReadAckResult> {
  const eligible = tasks.filter((t) => t.expected_action_type === 'read_ack');
  const succeededIds: string[] = [];
  let failedCount = 0;

  for (const task of eligible) {
    try {
      await decideOne(task, BATCH_READ_ACK_COMMENT);
      succeededIds.push(task.id);
    } catch {
      failedCount += 1;
    }
  }

  return { succeededIds, failedCount };
}
