// frontend/components/DocumentReservation.tsx
//
// Réservation d'un document (#274), dans l'en-tête de la fiche : qui le réserve et jusqu'à quand,
// « Réserver » / « Libérer », prolongation automatique tant que la fiche reste ouverte.
import React, { useCallback, useEffect, useState } from 'react';
import type { Document } from '../types';
import { api } from '../services/api';
import { ApiError } from '../lib/errors';
import { useAuthStore } from '../stores/authStore';
import {
  RESERVATION_REFRESH_MS,
  formatReservationTime,
  reservationErrorMessage,
  reservationView,
  type ReservationAction,
} from '../lib/documentReservation';

// Profils qui ont « documents update » ou « update_own » (policy.csv). Liste blanche : l'API fait foi
// (un collaborateur ne réserve que ses propres documents, sinon 403 affiché ici).
export const CAN_RESERVE_DOCUMENT = new Set(['super', 'tenant', 'unit', 'manager', 'collab']);
// Seul « documents manage » (super_admin) libère la réservation d'une autre personne.
export const CAN_RELEASE_ANY_RESERVATION = new Set(['super']);

/** Revérifie l'échéance chaque minute : une réservation expirée redevient « libre » sans recharger. */
const CLOCK_TICK_MS = 60 * 1000;

interface DocumentReservationProps {
  document: Document;
  onChange: (document: Document) => void;
}

const DocumentReservation: React.FC<DocumentReservationProps> = ({ document, onChange }) => {
  const profileId = useAuthStore((s) => s.userProfile?.id);
  const userId = useAuthStore((s) => s.userProfile?.userId);
  const [now, setNow] = useState(() => new Date());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const view = reservationView(document, userId, now);
  const canReserve = !!profileId && CAN_RESERVE_DOCUMENT.has(profileId) && !document.deleted_at;
  const canRelease =
    view.kind === 'mine' || (view.kind === 'other' && !!profileId && CAN_RELEASE_ANY_RESERVATION.has(profileId));

  useEffect(() => {
    if (view.kind === 'free') return undefined;
    const timer = window.setInterval(() => setNow(new Date()), CLOCK_TICK_MS);
    return () => window.clearInterval(timer);
  }, [view.kind]);

  /** Relit le document : l'état de réservation vient toujours du serveur. */
  const reload = useCallback(async () => {
    try {
      onChange(await api.getDocument(document.id));
    } catch (err) {
      console.error('Reload after reservation failed:', err);
    }
    setNow(new Date());
  }, [document.id, onChange]);

  const run = useCallback(
    async (action: ReservationAction, call: () => Promise<unknown>) => {
      setBusy(true);
      setError(null);
      try {
        await call();
      } catch (err) {
        setError(reservationErrorMessage(err instanceof ApiError ? err.status : 0, action));
      } finally {
        await reload();
        setBusy(false);
      }
    },
    [reload],
  );

  // Prolonge la réservation tant que la fiche est ouverte ; un échec (expirée, reprise) recharge l'état.
  useEffect(() => {
    if (view.kind !== 'mine') return undefined;
    const timer = window.setInterval(() => {
      api.refreshDocumentLock(document.id).then(
        ({ lock_expires_at: expiresAt }) => onChange({ ...document, lock_expires_at: expiresAt }),
        async (err: unknown) => {
          setError(reservationErrorMessage(err instanceof ApiError ? err.status : 0, 'refresh'));
          await reload();
        },
      );
    }, RESERVATION_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [view.kind, document, onChange, reload]);

  if (!canReserve && view.kind === 'free') return null;

  return (
    <div className="flex items-center gap-2" data-testid="document-reservation">
      {view.kind !== 'free' && (
        <span
          role="status"
          className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
            view.kind === 'mine' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
          }`}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '12px' }} aria-hidden="true">lock</span>
          {view.kind === 'mine' ? 'Réservé par vous' : `Réservé par ${view.who}`} jusqu'à {formatReservationTime(view.until)}
        </span>
      )}
      {canReserve && view.kind === 'free' && (
        <button
          type="button"
          disabled={busy}
          onClick={() => run('reserve', () => api.lockDocument(document.id))}
          title="Personne d'autre ne pourra le modifier pendant 30 min."
          className="text-xs font-bold px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50"
        >
          Réserver
        </button>
      )}
      {canRelease && (
        <button
          type="button"
          disabled={busy}
          onClick={() => run('release', () => api.unlockDocument(document.id))}
          title={view.kind === 'mine' ? 'Rendre le document modifiable par les autres.' : 'Libérer la réservation de cette personne.'}
          className="text-xs font-bold px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50"
        >
          Libérer
        </button>
      )}
      {error && (
        <span role="alert" className="text-xs font-semibold text-red-600">
          {error}
        </span>
      )}
    </div>
  );
};

export default DocumentReservation;
