import React, { useEffect, useId, useState } from 'react';
import { api } from '../../services/api';
import type { WorkflowValidator } from '../../types';
import { useAuthStore } from '../../stores/authStore';
import { pickInitialValidator, readLastValidator, saveLastValidator } from '../../lib/lastValidator';
import { pushSuccess } from '../../lib/successNotice';

interface SubmitForValidationDialogProps {
  documentId: string;
  onClose: () => void;
  /** Appelé après une soumission réussie (la confirmation verte est déjà affichée). */
  onSubmitted: () => void;
}

/**
 * Envoi d'un brouillon au visa (circuit d'une étape) : partagé par « Mon Atelier » et « Mes Documents ».
 * Le dernier valideur choisi est proposé d'office.
 */
export const SubmitForValidationDialog: React.FC<SubmitForValidationDialogProps> = ({ documentId, onClose, onSubmitted }) => {
  const userId = useAuthStore((s) => s.userProfile?.userId);
  const selectId = useId();
  const [validators, setValidators] = useState<WorkflowValidator[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedValidator, setSelectedValidator] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let alive = true;
    // Valideurs proposables (managers et administrateurs du tenant) ; liste vide si l'appel échoue.
    api.getWorkflowValidators()
      .catch(() => [] as WorkflowValidator[])
      .then((list) => {
        if (!alive) return;
        setValidators(list);
        setSelectedValidator(pickInitialValidator(readLastValidator(userId), list.map((v) => v.id)));
        setLoading(false);
      });
    return () => { alive = false; };
  }, [userId]);

  const submit = async () => {
    if (!selectedValidator) return;
    setSubmitting(true);
    try {
      await api.createWorkflowSteps(documentId, [
        { document_id: documentId, step_order: 1, label: 'Validation Manager', assigned_to: selectedValidator },
      ]);
      saveLastValidator(userId, selectedValidator);
      pushSuccess('Document envoyé pour validation.');
      onSubmitted();
    } catch (e) {
      // L'erreur HTTP est déjà publiée par le client (bus global) : pas de second message.
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div role="dialog" aria-modal="true" aria-labelledby={`${selectId}-title`} className="bg-white rounded-[2.5rem] p-10 w-full max-w-lg shadow-2xl relative">
        <button
          type="button"
          aria-label="Fermer"
          onClick={onClose}
          className="absolute top-6 right-6 w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
        >
          <span className="material-symbols-outlined">close</span>
        </button>

        <h3 id={`${selectId}-title`} className="text-2xl font-black text-slate-800 mb-2">Circuit de Validation</h3>
        <p className="text-sm text-slate-500 font-medium mb-8">Choisissez la personne qui doit valider ce document.</p>

        <div className="space-y-6">
          <div className="space-y-2">
            <label htmlFor={selectId} className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Valideur (Manager/Directeur)</label>
            <select
              id={selectId}
              value={selectedValidator}
              onChange={(e) => setSelectedValidator(e.target.value)}
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-3 px-4 font-bold text-slate-700 outline-none focus:border-cam-yellow/50 appearance-none"
            >
              <option value="" disabled>-- Sélectionner un manager --</option>
              {validators.map((validator) => (
                <option key={validator.id} value={validator.id}>
                  {validator.full_name}
                </option>
              ))}
            </select>
            {!loading && validators.length === 0 && (
              <p className="ml-1 text-xs text-slate-400">Aucun valideur disponible. Contactez votre administrateur.</p>
            )}
          </div>

          <button
            type="button"
            onClick={submit}
            disabled={submitting || !selectedValidator}
            className="w-full py-4 bg-cam-yellow text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-yellow-200 hover:bg-yellow-600 hover:scale-[1.02] transition-all disabled:opacity-70 disabled:hover:scale-100"
          >
            {submitting ? 'Envoi en cours...' : 'Soumettre au visa'}
          </button>
        </div>
      </div>
    </div>
  );
};
