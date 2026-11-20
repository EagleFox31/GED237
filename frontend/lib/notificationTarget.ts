/** Où mène une notification : le document concerné, sinon la liste des tâches. */
export function notificationTarget(metaData: unknown): string {
  const id = (metaData as { document_id?: unknown } | null | undefined)?.document_id;
  return typeof id === 'string' && id ? `/documents?open=${encodeURIComponent(id)}` : '/tasks';
}
