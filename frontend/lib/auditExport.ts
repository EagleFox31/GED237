// Acteurs envoyés à l'export CSV du journal d'audit, à partir des acteurs cochés dans le tableau.
// Le serveur accepte user_id répété ; les actions système (sans utilisateur) n'ont pas d'identifiant
// à filtrer : l'export est bloqué tant qu'elles restent cochées, pour ne pas les omettre en silence.

export interface AuditActorRow {
  user_id?: string | null;
  user_name?: string | null;
  user_matricule?: string | null;
}

export const SYSTEM_ACTOR_LABEL = 'Système';

export function auditActorLabel(log: AuditActorRow): string {
  return log.user_name || log.user_matricule || SYSTEM_ACTOR_LABEL;
}

export function auditExportActors(
  logs: AuditActorRow[],
  actorLabels: string[],
): { userIds: string[]; blocked: boolean } {
  if (actorLabels.length === 0) return { userIds: [], blocked: false };
  const ids = new Set<string>();
  const labelsWithUser = new Set<string>();
  for (const log of logs) {
    const label = auditActorLabel(log);
    if (log.user_id && actorLabels.includes(label)) {
      ids.add(log.user_id);
      labelsWithUser.add(label);
    }
  }
  const blocked = actorLabels.some((label) => !labelsWithUser.has(label));
  return { userIds: [...ids].sort(), blocked };
}
