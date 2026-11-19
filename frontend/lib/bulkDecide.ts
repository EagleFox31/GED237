// Visa en lot (Tâches & Suivi) : une décision par tâche, l'une après l'autre, sur la route existante.
// Une tâche en échec n'arrête pas les suivantes ; ce qui est passé reste acquis.
import { ApiError } from './errors/ApiError';

export interface BulkTask {
  id: string;
  title: string;
}

export interface BulkFailure extends BulkTask {
  message: string;
}

export interface BulkOutcome {
  done: string[];
  failed: BulkFailure[];
}

const FALLBACK = 'Décision impossible sur ce document.';

export const bulkFailureMessage = (err: unknown): string => {
  if (err instanceof ApiError) return err.userMessage || FALLBACK;
  if (err instanceof Error && err.message) return err.message;
  return FALLBACK;
};

/** Appels en série : pas de rafale sur le serveur, et un bilan dans l'ordre affiché. */
export async function bulkDecide<T extends BulkTask>(
  tasks: readonly T[],
  decideOne: (task: T) => Promise<unknown>,
  onProgress?: (handled: number) => void,
): Promise<BulkOutcome> {
  const outcome: BulkOutcome = { done: [], failed: [] };
  for (const task of tasks) {
    try {
      await decideOne(task);
      outcome.done.push(task.id);
    } catch (err) {
      outcome.failed.push({ id: task.id, title: task.title, message: bulkFailureMessage(err) });
    }
    onProgress?.(outcome.done.length + outcome.failed.length);
  }
  return outcome;
}

export const bulkDoneLabel = (n: number): string =>
  n === 1 ? '1 tâche visée.' : `${n} tâches visées.`;

export const bulkConfirmTitle = (n: number): string =>
  n === 1 ? 'Viser 1 tâche ?' : `Viser ${n} tâches ?`;
