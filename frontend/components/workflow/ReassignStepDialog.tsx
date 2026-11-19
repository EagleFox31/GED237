import React, { useEffect, useId, useState } from 'react';
import { api } from '../../services/api';
import type { WorkflowValidator } from '../../types';
import { reassignCandidates } from '../../lib/reassign';

interface ReassignStepDialogProps {
  /** Étape à confier à quelqu'un d'autre ; null ferme la boîte. */
  step: { id: string; label: string; assigned_to: string | null } | null;
  onDone: () => void;
  onCancel: () => void;
}

/**
 * Confier une étape à un autre valideur, quand celui prévu est absent sans l'avoir annoncé.
 * Le nouveau valideur est prévenu ; le journal garde l'ancien et le nouveau.
 */
export const ReassignStepDialog: React.FC<ReassignStepDialogProps> = ({ step, onDone, onCancel }) => {
  const [validators, setValidators] = useState<WorkflowValidator[]>([]);
  const [selected, setSelected] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);
  const titleId = useId();
  const fieldId = useId();
  const open = step !== null;

  useEffect(() => {
    if (!open) return;
    setSelected('');
    setFailed(false);
    let cancelled = false;
    api.getWorkflowValidators()
      .then((list) => { if (!cancelled) setValidators(list); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [open]);

  if (!step) return null;

  const candidates = reassignCandidates(validators, step.assigned_to);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || submitting) return;
    setSubmitting(true);
    setFailed(false);
    try {
      await api.assignPendingStep(step.id, selected);
      onDone();
    } catch {
      setFailed(true);
    } finally {
      setSubmitting(false);
    }
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
          Confier à quelqu&apos;un d&apos;autre
        </h3>
        <p className="mt-2 text-sm text-slate-500">
          Étape « {step.label} ». La personne choisie est prévenue et pourra la traiter tout de suite.
        </p>

        <label htmlFor={fieldId} className="mt-5 block text-[10px] font-black uppercase tracking-widest text-slate-400">
          Nouveau valideur
        </label>
        <select
          id={fieldId}
          autoFocus
          required
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="mt-2 w-full rounded-2xl border-2 border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-blue-200"
        >
          <option value="">Choisir une personne</option>
          {candidates.map((v) => (
            <option key={v.id} value={v.id}>{v.full_name}</option>
          ))}
        </select>

        {failed && (
          <p role="alert" className="mt-3 text-xs font-bold text-red-600">
            Impossible de confier l&apos;étape. Réessayez.
          </p>
        )}

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
            disabled={!selected || submitting}
            className="rounded-2xl bg-rdpc-blue px-5 py-3 text-xs font-black uppercase tracking-widest text-white transition-colors hover:bg-blue-800 disabled:opacity-50"
          >
            {submitting ? 'Envoi…' : 'Confier l’étape'}
          </button>
        </div>
      </form>
    </div>
  );
};
