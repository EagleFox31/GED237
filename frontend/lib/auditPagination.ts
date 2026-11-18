// Pagination du registre des actions : le serveur sert /audit/logs par skip/limit (limit ≤ 500),
// sans total. Une page pleine laisse supposer une suite ; une page incomplète est la dernière.

export const AUDIT_PAGE_SIZE = 200;

/** Paramètres skip/limit de la page `page` (0 = première page). */
export function auditPageQuery(page: number, pageSize: number = AUDIT_PAGE_SIZE): { skip: number; limit: number } {
  const safePage = Number.isInteger(page) && page > 0 ? page : 0;
  return { skip: safePage * pageSize, limit: pageSize };
}

/** « Suivant » n'est actif que si la page reçue est pleine. */
export function hasNextAuditPage(rowCount: number, pageSize: number = AUDIT_PAGE_SIZE): boolean {
  return rowCount >= pageSize;
}
