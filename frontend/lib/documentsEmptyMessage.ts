// frontend/lib/documentsEmptyMessage.ts
export const DOCUMENTS_EMPTY_DEFAULT = 'Aucun document trouvé.';
export const DOCUMENTS_EMPTY_SCOPED =
  'Aucun document trouvé dans les services auxquels vous avez accès.';

export function emptyDocumentsMessage(opts: {
  query?: string | null;
  status?: string | null;
}): string {
  const hasQuery = Boolean((opts.query ?? '').trim());
  const hasFilter = Boolean((opts.status ?? '').trim());
  return hasQuery || hasFilter ? DOCUMENTS_EMPTY_SCOPED : DOCUMENTS_EMPTY_DEFAULT;
}
