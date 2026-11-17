import React from 'react';

import type { UndoOffer } from '../../hooks/useUndoableAction';

type Props = {
  offer: UndoOffer | null;
  onUndo: () => void;
  onDismiss: () => void;
};

/** Message en bas de l'écran après une action, avec « Annuler » quand le retour est possible. */
export const UndoToast: React.FC<Props> = ({ offer, onUndo, onDismiss }) => (
  <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-[120] flex justify-center px-4">
    {offer && (
      <div
        role="status"
        className="pointer-events-auto flex max-w-md items-center gap-4 rounded-2xl bg-slate-900 px-5 py-3 text-sm text-white shadow-2xl"
      >
        <span className="min-w-0 flex-1 truncate">{offer.message}</span>
        {offer.undo && (
          <button
            type="button"
            onClick={onUndo}
            title="Annuler (Ctrl+Z)"
            className="shrink-0 rounded-lg px-2 py-1 font-bold text-amber-300 hover:bg-white/10"
          >
            Annuler
          </button>
        )}
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Fermer le message"
          className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden>close</span>
        </button>
      </div>
    )}
  </div>
);
