// frontend/lib/documentsEmptyMessage.ts
export const DOCUMENTS_EMPTY_DEFAULT = 'Aucun document trouvé.';
export const DOCUMENTS_EMPTY_SEARCH = 'Aucun document ne correspond à votre recherche.';
export const DOCUMENTS_EMPTY_FILTER = 'Aucun document ne correspond au filtre sélectionné.';

export function emptyDocumentsMessage(opts: {
  query?: string | null;
  status?: string | null;
}): string {
  const hasQuery = Boolean((opts.query ?? '').trim());
  const hasFilter = Boolean((opts.status ?? '').trim());
  if (hasQuery) return DOCUMENTS_EMPTY_SEARCH;
  if (hasFilter) return DOCUMENTS_EMPTY_FILTER;
  return DOCUMENTS_EMPTY_DEFAULT;
}
