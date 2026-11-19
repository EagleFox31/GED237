// Nombre de tâches en attente affiché dans le menu (pastille sur « Tâches »).

/** Événement émis après une décision (validation, rejet) : le menu relit le nombre aussitôt. */
export const TASKS_CHANGED_EVENT = 'ged:tasks-changed';

export function notifyTasksChanged(): void {
  window.dispatchEvent(new Event(TASKS_CHANGED_EVENT));
}

/** Texte de la pastille : rien à 0, « 99+ » au-delà de 99. */
export function taskBadgeLabel(count: number): string {
  if (!Number.isFinite(count) || count <= 0) return '';
  return count > 99 ? '99+' : String(Math.floor(count));
}
