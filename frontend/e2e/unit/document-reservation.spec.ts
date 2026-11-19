import { test, expect } from '@playwright/test';
import {
  UNKNOWN_HOLDER,
  reservationErrorMessage,
  reservationView,
} from '../../lib/documentReservation';

const NOW = new Date('2026-11-17T10:00:00Z');
const LATER = '2026-11-17T10:30:00Z';
const EARLIER = '2026-11-17T09:59:00Z';

test.describe('Réservation de document : état affiché', () => {
  test('sans réservation : libre', () => {
    expect(reservationView({ locked_by_user_id: null, lock_expires_at: null }, 'u1', NOW)).toEqual({ kind: 'free' });
  });

  test('réservée par moi : « mine » avec l’échéance', () => {
    const view = reservationView({ locked_by_user_id: 'u1', locked_by_name: 'Awa', lock_expires_at: LATER }, 'u1', NOW);
    expect(view).toEqual({ kind: 'mine', until: new Date(LATER) });
  });

  test('réservée par une autre personne : son nom', () => {
    const view = reservationView({ locked_by_user_id: 'u2', locked_by_name: 'Paul Ngo', lock_expires_at: LATER }, 'u1', NOW);
    expect(view).toEqual({ kind: 'other', who: 'Paul Ngo', until: new Date(LATER) });
  });

  test('nom absent (compte supprimé ou autre institution) : « un utilisateur »', () => {
    const view = reservationView({ locked_by_user_id: 'u2', locked_by_name: null, lock_expires_at: LATER }, 'u1', NOW);
    expect(view).toMatchObject({ kind: 'other', who: UNKNOWN_HOLDER });
  });

  test('échéance passée ou illisible : libre', () => {
    expect(reservationView({ locked_by_user_id: 'u2', lock_expires_at: EARLIER }, 'u1', NOW).kind).toBe('free');
    expect(reservationView({ locked_by_user_id: 'u2', lock_expires_at: 'pas une date' }, 'u1', NOW).kind).toBe('free');
  });

  test('utilisateur courant inconnu : jamais « mine »', () => {
    expect(reservationView({ locked_by_user_id: 'u1', lock_expires_at: LATER }, undefined, NOW).kind).toBe('other');
  });
});

test.describe('Réservation de document : messages d’erreur', () => {
  test('message choisi par le code HTTP, jamais le texte du serveur', () => {
    expect(reservationErrorMessage(423, 'reserve')).toBe('Déjà réservé par une autre personne.');
    expect(reservationErrorMessage(409, 'refresh')).toBe('Votre réservation a expiré.');
    expect(reservationErrorMessage(400, 'reserve')).toContain('corbeille');
    expect(reservationErrorMessage(403, 'reserve')).toContain('réserver');
    expect(reservationErrorMessage(403, 'release')).toContain('libérer');
    expect(reservationErrorMessage(403, 'refresh')).toBe('Votre réservation a été levée.');
    expect(reservationErrorMessage(500, 'release')).toBe('Libération impossible. Réessayez.');
    expect(reservationErrorMessage(0, 'reserve')).toBe('Réservation impossible. Réessayez.');
  });

  test('aucun message ne parle de « verrou »', () => {
    for (const status of [0, 400, 403, 409, 423, 500]) {
      for (const action of ['reserve', 'release', 'refresh'] as const) {
        expect(reservationErrorMessage(status, action).toLowerCase()).not.toContain('verrou');
      }
    }
  });
});
