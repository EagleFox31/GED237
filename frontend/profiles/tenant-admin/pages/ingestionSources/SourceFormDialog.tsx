import React, { useState } from 'react';
import { DialogFrame } from '../../../../components/ui/DialogFrame';
import { InlineHelpButton } from '../../../../components/ui/InlineHelpButton';
import type { ImportProcessingMode } from '../../../../types';
import type { IngestionSourceType } from '../../../../services/resources/ingestionSources.api';
import {
  PROCESSING_MODE_LABELS,
  SOURCE_TYPE_LABELS,
  validateSourceForm,
  type SourceForm,
  type SourceFormErrors,
} from './sourcesView';

export interface OrgUnitOption {
  id: string;
  name: string;
}

interface SourceFormDialogProps {
  /** `true` en modification : le type ne change plus (supprimer puis recréer). */
  editing: boolean;
  initial: SourceForm;
  orgUnits: OrgUnitOption[];
  busy: boolean;
  onSubmit: (form: SourceForm) => void;
  /** Stable (useCallback). */
  onClose: () => void;
}

const TYPES: IngestionSourceType[] = ['local', 'smb', 'agent'];
const MODES: ImportProcessingMode[] = ['archive', 'process'];

const inputClass =
  'mt-1 w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 focus:border-rdpc-blue focus:outline-none disabled:bg-slate-50';
const labelClass = 'block text-xs font-bold text-slate-600';

export const SourceFormDialog: React.FC<SourceFormDialogProps> = ({ editing, initial, orgUnits, busy, onSubmit, onClose }) => {
  const [form, setForm] = useState<SourceForm>(initial);
  const [errors, setErrors] = useState<SourceFormErrors>({});
  const set = <K extends keyof SourceForm>(key: K, value: SourceForm[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const found = validateSourceForm(form);
    setErrors(found);
    if (Object.keys(found).length === 0) onSubmit(form);
  };

  const fieldError = (key: keyof SourceFormErrors) =>
    errors[key] ? (
      <p id={`source-${key}-error`} className="mt-1 text-xs font-medium text-red-700">
        {errors[key]}
      </p>
    ) : null;

  return (
    <DialogFrame labelledBy="source-form-title" onClose={onClose} className="max-w-xl">
      <form onSubmit={handleSubmit} noValidate className="rounded-[2rem] bg-white p-7 shadow-2xl" aria-busy={busy}>
        <h2 id="source-form-title" className="text-xl font-black tracking-tight text-slate-900">
          {editing ? 'Modifier la source' : 'Nouvelle source'}
        </h2>
        <fieldset disabled={busy} className="mt-5 space-y-4">
          <label className={labelClass}>
            Nom
            <input
              value={form.name}
              onChange={(event) => set('name', event.target.value)}
              maxLength={150}
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? 'source-name-error' : undefined}
              className={inputClass}
            />
            {fieldError('name')}
          </label>

          <fieldset>
            <legend className={labelClass}>Type</legend>
            <div className="mt-1 flex flex-wrap gap-2">
              {TYPES.map((type) => (
                <label
                  key={type}
                  className={`flex items-center gap-2 rounded-2xl border-2 px-3 py-2 text-sm font-medium ${
                    form.source_type === type ? 'border-rdpc-blue text-slate-900' : 'border-slate-200 text-slate-600'
                  } ${editing ? 'opacity-60' : 'cursor-pointer'}`}
                >
                  <input
                    type="radio"
                    name="source-type"
                    value={type}
                    checked={form.source_type === type}
                    disabled={editing}
                    onChange={() => set('source_type', type)}
                  />
                  {SOURCE_TYPE_LABELS[type]}
                </label>
              ))}
            </div>
          </fieldset>

          {form.source_type !== 'agent' && (
            <div className="relative">
              <label className={labelClass}>
                Dossier sur le serveur
                <input
                  value={form.path}
                  onChange={(event) => set('path', event.target.value)}
                  placeholder="/data/ingest/courrier"
                  maxLength={1024}
                  aria-invalid={!!errors.path}
                  aria-describedby={errors.path ? 'source-path-error' : undefined}
                  className={`${inputClass} font-mono`}
                />
              </label>
              <InlineHelpButton
                label="Aide sur le dossier"
                className="absolute right-0 top-0"
                content="Le dossier doit se trouver dans un emplacement autorisé du serveur. Sinon, la source est refusée."
              />
              {fieldError('path')}
            </div>
          )}

          {form.source_type === 'smb' && (
            <div className="relative">
              <label className={labelClass}>
                Nom du secret de connexion (facultatif)
                <input
                  value={form.credentials_ref}
                  onChange={(event) => set('credentials_ref', event.target.value)}
                  maxLength={128}
                  aria-invalid={!!errors.credentials_ref}
                  aria-describedby={errors.credentials_ref ? 'source-credentials_ref-error' : undefined}
                  className={`${inputClass} font-mono`}
                />
              </label>
              <InlineHelpButton
                label="Aide sur le secret"
                className="absolute right-0 top-0"
                content="Le nom du secret enregistré sur le serveur, jamais le mot de passe."
              />
              {fieldError('credentials_ref')}
            </div>
          )}

          <label className={labelClass}>
            Service destinataire
            <select value={form.org_unit_id} onChange={(event) => set('org_unit_id', event.target.value)} className={inputClass}>
              {!editing && <option value="">Mon service</option>}
              {editing && form.org_unit_id && !orgUnits.some((unit) => unit.id === form.org_unit_id) && (
                <option value={form.org_unit_id}>Service actuel</option>
              )}
              {orgUnits.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
            </select>
          </label>

          <label className={labelClass}>
            Traitement
            <select
              value={form.processing_mode}
              onChange={(event) => set('processing_mode', event.target.value as ImportProcessingMode)}
              className={inputClass}
            >
              {MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {PROCESSING_MODE_LABELS[mode]}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input type="checkbox" checked={form.recursive} onChange={(event) => set('recursive', event.target.checked)} />
              Inclure les sous-dossiers
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input type="checkbox" checked={form.enabled} onChange={(event) => set('enabled', event.target.checked)} />
              Active
            </label>
          </div>
        </fieldset>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl px-5 py-3 text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-2xl bg-slate-900 px-6 py-3 text-xs font-black uppercase tracking-widest text-white hover:bg-rdpc-blue disabled:opacity-50"
          >
            {editing ? 'Enregistrer' : 'Créer'}
          </button>
        </div>
      </form>
    </DialogFrame>
  );
};
