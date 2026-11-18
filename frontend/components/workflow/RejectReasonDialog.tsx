import React, { useEffect, useId, useState } from 'react';

export const QUICK_REJECT_REASONS = [
  'Pièce manquante',
  'Erreur de saisie ou de montant',
  'Visa préalable manquant',
  'À reformuler',
] as const;

export function applyQuickRejectReason(current: string, quickReason: string): string {
  const trimmedCurrent = current.trim();
  if (!trimmedCurrent) return quickReason;
  if (trimmedCurrent.includes(quickReason)) return trimmedCurrent;
  return `${trimmedCurrent} · ${quickReason}`;
}

interface RejectReasonDialogProps {
  /** Titre du document rejeté ; null ferme la boîte. */
  documentTitle: string | null;
  submitting?: boolean;
  /** Titre de la boîte (défaut : rejet) ; `Renvoyer pour correction` réutilise la même saisie. */
  heading?: string;
  confirmLabel?: string;
  /** Valeur initiale optionnelle (utilisée notamment par les tests unitaires). */
  initialReason?: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

/**
 * Saisie du motif de rejet d'une étape de validation (Espace Manager, Tâches).
 * Le motif est obligatoire : le rédacteur le lit pour corriger son document.
 */
export const RejectReasonDialog: React.FC<RejectReasonDialogProps> = ({
  documentTitle,
  submitting = false,
  heading = 'Rejeter le document',
  confirmLabel = 'Confirmer le rejet',
  initialReason = '',
  onConfirm,
  onCancel,
}) => {
  const [reason, setReason] = useState(initialReason);
  const titleId = useId();
  const fieldId = useId();
  const open = documentTitle !== null;

  useEffect(() => {
    if (open) setReason(initialReason);
  }, [open, initialReason]);

  if (!open) return null;

  const trimmed = reason.trim();
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (trimmed && !submitting) onConfirm(trimmed);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && !submitting) onCancel();
      }}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onSubmit={submit}
        className="w-full max-w-lg rounded-[2rem] border border-slate-200 bg-white p-7 shadow-[0_24px_80px_rgba(15,23,42,0.18)]"
      >
        <h3 id={titleId} className="text-2xl font-black uppercase italic tracking-tight text-slate-900">
          {heading}
        </h3>
        <p className="mt-2 text-sm text-slate-500 line-clamp-2">« {documentTitle} »</p>

        <label htmlFor={fieldId} className="mt-5 block text-[10px] font-black uppercase tracking-widest text-slate-400">
          Motif du rejet
        </label>

        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Motifs fréquents">
          {QUICK_REJECT_REASONS.map((label) => (
            <button
              key={label}
              type="button"
              disabled={submitting}
              onClick={() => setReason((prev) => applyQuickRejectReason(prev, label))}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-600 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
            >
              {label}
            </button>
          ))}
        </div>

        <textarea
          id={fieldId}
          autoFocus
          required
          rows={4}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Ce que le rédacteur doit corriger"
          className="mt-2 w-full rounded-2xl border-2 border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-red-200"
        />

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="rounded-2xl border-2 border-slate-200 bg-white px-5 py-3 text-xs font-black uppercase tracking-widest text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-800 disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={!trimmed || submitting}
            className="rounded-2xl bg-red-500 px-5 py-3 text-xs font-black uppercase tracking-widest text-white transition-colors hover:bg-red-600 disabled:opacity-50"
          >
            {submitting ? '...' : confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
};
