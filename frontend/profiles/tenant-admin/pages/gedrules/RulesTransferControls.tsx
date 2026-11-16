import React, { useEffect, useId, useRef, useState } from 'react';
import { api } from '../../../../services/api';
import type { RulesImportReport } from '../../../../services/resources/classification.api';
import { ApiError } from '../../../../lib/errors';
import { pushClientOperationError } from '../../../../lib/errors/clientOperationError';

interface RulesTransferControlsProps {
  /** Appelé après un import appliqué, pour recharger la liste des règles. */
  onImported: () => void;
}

const ACTION_LABELS: Record<string, string> = {
  create: 'À créer',
  update: 'À mettre à jour',
  skip: 'Identique',
  reject: 'Rejetée',
};

/**
 * Export / import des règles de classement (fichier JSON).
 * L'import passe toujours par une simulation : rien n'est écrit tant que
 * l'utilisateur n'a pas confirmé le résumé.
 */
export const RulesTransferControls: React.FC<RulesTransferControlsProps> = ({ onImported }) => {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const titleId = useId();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState<{ content: unknown; report: RulesImportReport } | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [notice]);

  // Les erreurs HTTP sont déjà affichées par le bus global ; reste le cas local (fichier illisible).
  const reportError = (err: unknown, fallbackDetail: string) => {
    if (!(err instanceof ApiError)) pushClientOperationError(err, { fallbackDetail });
  };

  const exportRules = async () => {
    setBusy(true);
    try {
      const { blob, filename } = await api.exportClassificationRules();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      // Différé : une révocation immédiate peut annuler le téléchargement sous Firefox.
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (err) {
      reportError(err, "Export des règles impossible.");
    } finally {
      setBusy(false);
    }
  };

  const onFileChosen = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      let content: unknown;
      try {
        content = JSON.parse(await file.text());
      } catch {
        pushClientOperationError(new Error('Fichier illisible'), {
          fallbackDetail: "Ce fichier n'est pas un export de règles valide.",
        });
        return;
      }
      const report = await api.importClassificationRules(content, { dryRun: true });
      setPending({ content, report });
    } catch (err) {
      reportError(err, "Import des règles impossible.");
    } finally {
      setBusy(false);
    }
  };

  const confirmImport = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      const result = await api.importClassificationRules(pending.content, { dryRun: false });
      if (result.applied) {
        setPending(null);
        const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;
        setNotice(
          `${plural(result.created, 'règle créée', 'règles créées')}, ${plural(result.updated, 'mise à jour', 'mises à jour')}`,
        );
        onImported();
      } else {
        // Une règle a été rejetée entre-temps : on affiche le nouveau rapport, rien n'a été écrit.
        setPending({ content: pending.content, report: result });
      }
    } catch (err) {
      reportError(err, "Import des règles impossible.");
    } finally {
      setBusy(false);
    }
  };

  const report = pending?.report ?? null;
  const problems = report?.items.filter((item) => item.action === 'reject') ?? [];
  const canConfirm = report !== null && report.rejected === 0 && report.created + report.updated > 0;

  return (
    <>
      <div className="mb-2 flex gap-2">
        <button
          type="button"
          onClick={exportRules}
          disabled={busy}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-widest text-slate-600 hover:text-violet-700 disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-base">download</span>
          Exporter
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-widest text-slate-600 hover:text-violet-700 disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-base">upload</span>
          Importer
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          aria-label="Fichier de règles à importer"
          className="hidden"
          onChange={onFileChosen}
        />
      </div>

      {notice && (
        <p role="status" className="mb-2 rounded-2xl bg-green-50 px-4 py-2 text-xs font-bold text-green-800">
          {notice}
        </p>
      )}

      {report && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4"
          onKeyDown={(e) => {
            if (e.key === 'Escape' && !busy) setPending(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="w-full max-w-lg rounded-[2rem] border border-slate-200 bg-white p-7 shadow-[0_24px_80px_rgba(15,23,42,0.18)]"
          >
            <h3 id={titleId} className="text-2xl font-black uppercase italic tracking-tight text-slate-900">
              Importer les règles
            </h3>
            <p className="mt-3 text-sm font-semibold text-slate-700">
              {report.created} à créer, {report.updated} à mettre à jour, {report.skipped} identiques,{' '}
              {report.rejected} rejetées
            </p>

            {problems.length > 0 && (
              <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto rounded-2xl bg-red-50 p-3 text-xs text-red-800">
                {problems.map((item) => (
                  <li key={item.code}>
                    <span className="font-bold">{item.code}</span> : {item.reason || ACTION_LABELS.reject}
                  </li>
                ))}
              </ul>
            )}
            {problems.length > 0 && (
              <p className="mt-2 text-xs text-slate-500">Corrigez le fichier : rien n'est importé tant qu'une règle est rejetée.</p>
            )}
            {problems.length === 0 && !canConfirm && (
              <p className="mt-2 text-xs text-slate-500">Rien à importer : toutes les règles sont déjà à jour.</p>
            )}

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setPending(null)}
                disabled={busy}
                className="rounded-2xl border-2 border-slate-200 bg-white px-5 py-3 text-xs font-black uppercase tracking-widest text-slate-600 hover:border-slate-300 disabled:opacity-50"
              >
                {canConfirm ? 'Annuler' : 'Fermer'}
              </button>
              {canConfirm && (
                <button
                  type="button"
                  onClick={confirmImport}
                  disabled={busy}
                  className="rounded-2xl bg-violet-600 px-5 py-3 text-xs font-black uppercase tracking-widest text-white hover:bg-violet-700 disabled:opacity-50"
                >
                  {busy ? '...' : 'Confirmer'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
