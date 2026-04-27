import React, { useRef, useState } from 'react';
import { api } from '../../../../services/api';
import { useDialogA11y, errorMessage } from './hooks';

interface CreateOrgUnitModalProps {
  tenantId: string;
  parent?: { id: string; name: string; level: number } | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateOrgUnitModal: React.FC<CreateOrgUnitModalProps> = ({ tenantId, parent, onClose, onSuccess }) => {
  const [form, setForm] = useState({ name: '', code: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLFormElement>(null);
  useDialogA11y(onClose, dialogRef);

  const isChild = !!parent;
  const title = isChild ? `Nouveau sous-service de "${parent!.name}"` : 'Nouveau service racine';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.code.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.createOrgUnit({
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        tenant_id: tenantId,
        parent_id: parent?.id ?? null,
        level: parent ? parent.level + 1 : 1,
        is_active: true,
      });
      onSuccess();
      onClose();
    } catch (err) {
      setError(errorMessage(err, 'Création impossible'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-8"
      onClick={() => !submitting && onClose()}
    >
      <form
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-orgunit-title"
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl space-y-5"
      >
        <h3 id="create-orgunit-title" className="text-2xl font-black italic uppercase text-slate-900 tracking-tighter">{title}</h3>
        {isChild && (
          <p className="text-xs text-slate-500 -mt-3">
            Niveau {parent!.level + 1} · rattaché à <span className="font-bold text-slate-700">{parent!.name}</span>
          </p>
        )}

        {error && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}

        <div className="space-y-4">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Nom du service *</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Direction Générale"
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border-2 border-slate-100 focus:border-rdpc-blue outline-none text-sm"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Code *</label>
            <input
              type="text"
              required
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="DG"
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border-2 border-slate-100 focus:border-rdpc-blue outline-none text-sm uppercase"
            />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-600 text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={submitting || !form.name.trim() || !form.code.trim()}
            className="flex-1 py-3 rounded-xl bg-rdpc-blue text-white text-xs font-black uppercase tracking-widest hover:bg-blue-800 transition-all disabled:opacity-50"
          >
            {submitting ? 'Création...' : 'Créer'}
          </button>
        </div>
      </form>
    </div>
  );
};
