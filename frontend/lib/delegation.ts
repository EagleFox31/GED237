// Délégation pendant une absence (L4) : règles d'affichage pures, testées en unitaire.
import type { Delegation, DelegationStatus } from '../types';

export const DELEGATION_STATUS_LABELS: Record<DelegationStatus, string> = {
  scheduled: 'Prévu',
  active: 'En cours',
  ended: 'Terminé',
  revoked: 'Annulé',
};

const pad = (n: number) => String(Math.abs(n)).padStart(2, '0');

/**
 * Valeur d'un champ `datetime-local` (heure locale, sans fuseau) → ISO 8601 avec le décalage
 * du navigateur. Le serveur refuse une date sans fuseau (422). `null` si la saisie est invalide.
 */
export function toAwareIso(datetimeLocal: string): string | null {
  if (!datetimeLocal) return null;
  const date = new Date(datetimeLocal);
  if (Number.isNaN(date.getTime())) return null;
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:00` +
    `${sign}${pad(Math.trunc(offset / 60))}:${pad(offset % 60)}`
  );
}

/**
 * Nom de l'agent absent quand la tâche m'arrive par délégation : elle est assignée à quelqu'un
 * d'autre ET une délégation en cours me désigne comme son intérimaire. Sinon `null`
 * (une tâche de groupe ou sans délégation connue n'affiche rien).
 */
export function onBehalfOfName(
  assignedTo: string | null | undefined,
  myUserId: string | undefined,
  mine: Delegation[],
): string | null {
  if (!assignedTo || !myUserId || assignedTo === myUserId) return null;
  const match = mine.find(
    (d) => d.status === 'active' && d.delegate.id === myUserId && d.delegator.id === assignedTo,
  );
  return match ? match.delegator.full_name : null;
}

/** Ma délégation sortante en cours (je suis absent), pour le bandeau de « Mes tâches ». */
export function myOutgoingActive(mine: Delegation[], myUserId: string | undefined): Delegation | null {
  if (!myUserId) return null;
  return mine.find((d) => d.status === 'active' && d.delegator.id === myUserId) ?? null;
}

/** Agent proposé dans le formulaire de remplacement (sous-ensemble de GET /users). */
export interface DelegationCandidate {
  id: string;
  full_name: string;
  org_unit_id?: string | null;
  /** Code du rôle (GET /users `role`). */
  role?: string | null;
}

/**
 * Miroir de policy.csv (`workflows, resolve_review`) : seuls ces rôles peuvent valider, donc
 * remplacer un absent. Le serveur refuse les autres (422 « Cet agent ne peut pas valider »).
 */
const STAND_IN_ROLES: ReadonlyArray<string> = ['manager', 'collaborator'];

/** Rôle connu et sans droit de validation. Un rôle absent de la réponse n'exclut personne. */
const cannotValidate = (u: DelegationCandidate) => Boolean(u.role) && !STAND_IN_ROLES.includes(String(u.role).toLowerCase());

/** Agents qu'on peut déclarer absents : rattachés à un service, jamais soi-même (refus du serveur). */
export function absentCandidates(users: DelegationCandidate[], myUserId: string | undefined): DelegationCandidate[] {
  return users.filter((u) => u.id !== myUserId && Boolean(u.org_unit_id));
}

/**
 * Remplaçants possibles : même service que l'agent absent, capables de valider (règles du
 * serveur), ni lui ni soi-même.
 */
export function standInCandidates(
  users: DelegationCandidate[],
  myUserId: string | undefined,
  absentId: string,
): DelegationCandidate[] {
  const unit = users.find((u) => u.id === absentId)?.org_unit_id;
  if (!unit) return [];
  return users.filter(
    (u) => u.id !== myUserId && u.id !== absentId && u.org_unit_id === unit && !cannotValidate(u),
  );
}

/** Date courte lisible (« 20/11/2026 18:00 »). */
export function formatDelegationDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
}
