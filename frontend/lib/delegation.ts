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

/**
 * Agent proposé dans le formulaire de remplacement : GET /delegations/candidates (agents actifs
 * d'un service), ou sous-ensemble de GET /users pour l'administrateur de l'institution.
 */
export interface DelegationCandidate {
  id: string;
  full_name: string;
  org_unit_id?: string | null;
  /** Code du rôle. */
  role?: string | null;
  /** Peut valider, donc remplacer un absent (`workflows resolve_review`, évalué par le serveur). */
  can_stand_in?: boolean;
}

/**
 * Profils qui choisissent l'absent dans toute l'institution (GET /users). Miroir de
 * TENANT_WIDE_ROLES (delegation_service) et de `users read` ; les autres profils, dont le chef de
 * service, passent par GET /delegations/candidates, limité à leur service.
 */
const INSTITUTION_WIDE_PROFILES: ReadonlyArray<string> = ['tenant'];

export const choosesAcrossInstitution = (profileId: string | undefined): boolean =>
  Boolean(profileId) && INSTITUTION_WIDE_PROFILES.includes(String(profileId));

/** Agents qu'on peut déclarer absents : rattachés à un service, jamais soi-même (refus du serveur). */
export function absentCandidates(users: DelegationCandidate[], myUserId: string | undefined): DelegationCandidate[] {
  return users.filter((u) => u.id !== myUserId && Boolean(u.org_unit_id));
}

/**
 * Remplaçants possibles parmi les candidats du service de l'absent : capables de valider selon le
 * serveur (`can_stand_in`), ni l'absent ni soi-même.
 */
export function standInCandidates(
  serviceCandidates: DelegationCandidate[],
  myUserId: string | undefined,
  absentId: string,
): DelegationCandidate[] {
  if (!absentId) return [];
  return serviceCandidates.filter((u) => u.id !== myUserId && u.id !== absentId && u.can_stand_in === true);
}

/** Date courte lisible (« 20/11/2026 18:00 »). */
export function formatDelegationDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
}
