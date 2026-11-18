// frontend/lib/documentsUrlFilter.ts
//
// Lecture et écriture du filtre de catégorie (`?category=<id>`) dans l'URL de
// l'explorateur `/documents`, en préservant les autres paramètres (`q`, `open`).

export const CATEGORY_PARAM = 'category';

export function readCategoryFilter(params: URLSearchParams): string {
  return (params.get(CATEGORY_PARAM) || '').trim();
}

export function writeCategoryFilter(
  current: URLSearchParams,
  categoryId: string,
): URLSearchParams {
  const next = new URLSearchParams(current);
  const trimmed = categoryId.trim();
  if (trimmed) next.set(CATEGORY_PARAM, trimmed);
  else next.delete(CATEGORY_PARAM);
  return next;
}
