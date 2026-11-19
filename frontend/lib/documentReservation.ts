// frontend/lib/documentReservation.ts
//
// Réservation d'un document (#274) : logique pure, sans React ni appel réseau.
// L'API pose une réservation de 30 min (POST /documents/{id}/lock) que son détenteur prolonge
// (refresh-lock) ; une échéance passée vaut document libre, même si les champs sont encore remplis.

import type { Document } from '../types';

export type ReservationView =
  | { kind: 'free' }
  | { kind: 'mine'; until: Date }
  | { kind: 'other'; who: string; until: Date };

/** Nom absent : compte supprimé ou d'une autre institution, l'API ne le donne pas. */
export const UNKNOWN_HOLDER = 'un utilisateur';

/** Prolongation bien avant l'échéance de 30 min, pour survivre à un onglet en veille quelques minutes. */
export const RESERVATION_REFRESH_MS = 10 * 60 * 1000;

type ReservationFields = Pick<Document, 'locked_by_user_id' | 'locked_by_name' | 'lock_expires_at'>;

export function reservationView(
  doc: ReservationFields,
  currentUserId: string | undefined,
  now: Date = new Date(),
): ReservationView {
  if (!doc.locked_by_user_id || !doc.lock_expires_at) return { kind: 'free' };
  const until = new Date(doc.lock_expires_at);
  if (Number.isNaN(until.getTime()) || until <= now) return { kind: 'free' };
  if (currentUserId && doc.locked_by_user_id === currentUserId) return { kind: 'mine', until };
  return { kind: 'other', who: doc.locked_by_name?.trim() || UNKNOWN_HOLDER, until };
}

export type ReservationAction = 'reserve' | 'release' | 'refresh';

/** Statuts que l'écran affiche lui-même (pas de toast global avec le texte du serveur). */
export const RESERVATION_HANDLED_STATUSES = [400, 403, 409, 423] as const;

/** Message choisi par le seul code HTTP : jamais le texte brut du serveur. */
export function reservationErrorMessage(status: number, action: ReservationAction): string {
  if (status === 423) return 'Déjà réservé par une autre personne.';
  if (status === 409) return 'Votre réservation a expiré.';
  if (status === 400) return 'Document dans la corbeille : réservation impossible.';
  if (status === 403) {
    // refresh-lock : 403 quand la réservation n'est plus à moi (libérée par un admin, reprise après expiration).
    if (action === 'refresh') return 'Votre réservation a été levée.';
    return action === 'reserve'
      ? "Vous n'avez pas le droit de réserver ce document."
      : "Seule la personne qui l'a réservé peut le libérer.";
  }
  return action === 'release' ? 'Libération impossible. Réessayez.' : 'Réservation impossible. Réessayez.';
}

/** « 14:05 » — heure locale, sans date : la réservation dure au plus 30 min. */
export function formatReservationTime(until: Date): string {
  return until.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}
