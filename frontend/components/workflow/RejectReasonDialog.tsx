import React, { useEffect, useId, useState } from 'react';

interface RejectReasonDialogProps {
  /** Titre du document rejeté ; null ferme la boîte. */
  documentTitle: string | null;
  submitting?: boolean;
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
  onConfirm,
  onCancel,
}) => {
  const [reason, setReason] = useState('');
  const titleId = useId();
  const fieldId = useId();
  const open = documentTitle !== null;

  useEffect(() => {
    if (open) setReason('');
  }, [open]);

  if (!open) return null;

  const trimmed = reason.trim();
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (trimmed && !submitting) onConfirm(trimmed);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4"
      onKeyDown={(e) => { if (e.key === 'Escape' && !submitting) onCancel(); }}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onSubmit={submit}
        className="w-full max-w-lg rounded-[2rem] border border-slate-200 bg-white p-7 shadow-[0_24px_80px_rgba(15,23,42,0.18)]"
      >
        <h3 id={titleId} className="text-2xl font-black uppercase italic tracking-tight text-slate-900">
          Rejeter le document
        </h3>
        <p className="mt-2 text-sm text-slate-500 line-clamp-2">« {documentTitle} »</p>

        <label htmlFor={fieldId} className="mt-5 block text-[10px] font-black uppercase tracking-widest text-slate-400">
          Motif du rejet
        </label>
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
            {submitting ? '...' : 'Confirmer le rejet'}
          </button>
        </div>
      </form>
    </div>
  );
};
