// Pagination du registre des actions : le serveur sert /audit/logs par skip/limit (limit ≤ 500),
// sans total. Une page pleine laisse supposer une suite ; une page incomplète est la dernière.

export const AUDIT_PAGE_SIZE = 200;

/** Paramètres skip/limit de la page `page` (0 = première page). */
export function auditPageQuery(page: number, pageSize: number = AUDIT_PAGE_SIZE): { skip: number; limit: number } {
  const safePage = Number.isInteger(page) && page > 0 ? page : 0;
  return { skip: safePage * pageSize, limit: pageSize };
}

/**
 * Filtres transmis au serveur : il n'accepte qu'une valeur par colonne (type, action).
 * Une seule valeur choisie filtre donc tout le journal ; plusieurs restent un filtre de la page.
 */
export function auditServerFilters(
  columnFilters: Record<string, string[] | undefined>,
): { table_name?: string; action?: string } {
  const single = (key: string) => {
    const values = columnFilters[key] ?? [];
    return values.length === 1 ? values[0] : undefined;
  };
  const filters: { table_name?: string; action?: string } = {};
  const table = single('table_name');
  const action = single('action');
  if (table) filters.table_name = table;
  if (action) filters.action = action;
  return filters;
}

/** Vrai si un filtre actif ne s'applique qu'aux lignes de la page (plusieurs valeurs, ou agent). */
export function hasPageOnlyFilter(columnFilters: Record<string, string[] | undefined>): boolean {
  return Object.entries(columnFilters).some(([key, values]) => {
    const count = values?.length ?? 0;
    if (count === 0) return false;
    return key === 'table_name' || key === 'action' ? count > 1 : true;
  });
}

/** « Suivant » n'est actif que si la page reçue est pleine. */
export function hasNextAuditPage(rowCount: number, pageSize: number = AUDIT_PAGE_SIZE): boolean {
  return rowCount >= pageSize;
}
