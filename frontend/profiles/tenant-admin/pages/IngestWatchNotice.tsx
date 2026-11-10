import React, { useEffect, useState } from 'react';
import { api } from '../../../services/api';
import type { IngestWatchStatus } from '../../../services/resources/documents.api';
import { HelpHint } from '../../../components/HelpHint';

const REFRESH_MS = 30_000;

const lastSegment = (path: string) => path.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || path;

const formatTime = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
};

export const describeWatchStatus = (status: IngestWatchStatus): string => {
  if (!status.enabled) return 'Surveillance désactivée';
  if (!status.last_run) return 'Surveillance active : aucun passage pour l\'instant';
  const { at, folders } = status.last_run;
  const imported = folders.reduce((sum, f) => sum + f.imported, 0);
  const skipped = folders.reduce((sum, f) => sum + f.skipped, 0);
  const errors = folders.reduce((sum, f) => sum + f.errors, 0);
  const names = folders.map((f) => lastSegment(f.path)).join(', ');
  const parts = [
    `${imported} ${imported > 1 ? 'importés' : 'importé'}`,
    `${skipped} ${skipped > 1 ? 'ignorés' : 'ignoré'}`,
  ];
  if (errors > 0) parts.push(`${errors} ${errors > 1 ? 'erreurs' : 'erreur'}`);
  return `Surveillance${names ? ` : ${names}` : ''} — dernier passage à ${formatTime(at)}, ${parts.join(', ')}`;
};

/**
 * Encart compact « Surveillance » : état du dernier passage de la
 * surveillance de dossier, relu toutes les 30 s. Discret en cas d'erreur
 * (une seule alerte globale, puis arrêt du rafraîchissement).
 */
export const IngestWatchNotice: React.FC = () => {
  const [status, setStatus] = useState<IngestWatchStatus | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const load = async () => {
      try {
        const next = await api.getIngestWatchStatus();
        if (cancelled) return;
        setStatus(next);
        timer = setTimeout(load, REFRESH_MS);
      } catch {
        // L'erreur HTTP est déjà signalée par le bus global ; on n'insiste pas.
        if (!cancelled) setFailed(true);
      }
    };

    void load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  if (failed || !status) return null;

  return (
    <div
      role="status"
      data-testid="ingest-watch-notice"
      className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600"
    >
      <span className="material-symbols-outlined text-base text-slate-400" aria-hidden="true">
        {status.enabled ? 'visibility' : 'visibility_off'}
      </span>
      <span className="flex-1">{describeWatchStatus(status)}</span>
      <HelpHint
        label="Aide sur la surveillance"
        tip="Les fichiers déposés dans le dossier surveillé sont importés sans action."
      >
        Le dossier est relu régulièrement : chaque nouveau fichier est importé et classé, un fichier déjà présent est ignoré comme doublon.
      </HelpHint>
    </div>
  );
};
