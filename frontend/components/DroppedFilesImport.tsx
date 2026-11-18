import React, { useState } from 'react';
import { api } from '../services/api';

interface Props {
  files: File[];
  /** Service de destination : le dossier sur lequel les fichiers ont été déposés. */
  orgUnitId: string;
  onClose: () => void;
  /** Appelé quand au moins un fichier est parti, pour recharger la liste. */
  onImported: () => void;
}

type Result = 'waiting' | 'sending' | 'done' | 'duplicate' | 'failed';

const LABELS: Record<Result, string> = {
  waiting: 'En attente',
  sending: 'Envoi…',
  done: 'Envoyé',
  duplicate: 'Déjà présent : refusé',
  failed: "L'envoi a échoué",
};

/** Import de plusieurs fichiers déposés : la liste, puis un envoi après confirmation. */
const DroppedFilesImport: React.FC<Props> = ({ files, orgUnitId, onClose, onImported }) => {
  const [results, setResults] = useState<Result[]>(() => files.map(() => 'waiting'));
  const [busy, setBusy] = useState(false);
  const [finished, setFinished] = useState(false);

  const setOne = (index: number, value: Result) => setResults((prev) => prev.map((r, i) => (i === index ? value : r)));

  const send = async () => {
    setBusy(true);
    let sent = 0;
    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      if (!file) continue;
      setOne(i, 'sending');
      const form = new FormData();
      form.append('file', file);
      form.append('title', file.name.replace(/\.[^/.]+$/, ''));
      form.append('processing_mode', 'process');
      form.append('org_unit_id', orgUnitId);
      try {
        // eslint-disable-next-line no-await-in-loop
        await api.uploadDocument(form);
        sent += 1;
        setOne(i, 'done');
      } catch (err: unknown) {
        setOne(i, (err as { status?: number })?.status === 409 ? 'duplicate' : 'failed');
      }
    }
    setBusy(false);
    setFinished(true);
    if (sent > 0) onImported();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" data-testid="dropped-files-import">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={busy ? undefined : onClose} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-label="Importer les fichiers déposés" className="relative bg-white rounded-[2rem] shadow-2xl w-full max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto p-8 space-y-5">
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Importer {files.length} fichiers</h2>
        <ul className="divide-y divide-slate-100 text-sm">
          {files.map((file, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <li key={`${file.name}-${i}`} data-testid="dropped-file" data-result={results[i]} className="flex justify-between gap-3 py-2">
              <span className="truncate font-semibold text-slate-700">{file.name}</span>
              <span className={`shrink-0 text-xs font-bold ${results[i] === 'done' ? 'text-emerald-600' : results[i] === 'duplicate' || results[i] === 'failed' ? 'text-red-600' : 'text-slate-400'}`}>
                {LABELS[results[i] ?? 'waiting']}
              </span>
            </li>
          ))}
        </ul>
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} disabled={busy} className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-2xl disabled:opacity-40">
            {finished ? 'Fermer' : 'Annuler'}
          </button>
          {!finished && (
            <button type="button" onClick={send} disabled={busy} className="px-5 py-2.5 text-sm font-bold text-white bg-rdpc-blue hover:opacity-90 rounded-2xl disabled:opacity-60">
              {busy ? 'Envoi…' : `Envoyer ${files.length} fichiers`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default DroppedFilesImport;
