import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Empty } from '../../../components/ui/Empty';
import { ConfirmationModal } from '../../../components/ui/ConfirmationModal';
import { Tooltip } from '../../../components/ui/Tooltip';
import {
  clearLocalLibrary,
  deleteLibraryRun,
  isLocalLibraryAvailable,
  listLibraryRuns,
  searchLocalLibrary,
  type LocalLibraryFileEntry,
  type LocalLibraryRun,
  type LocalLibrarySearchHit,
} from '../../../services/localLibrary';
import { api } from '../../../services/api';
import { LOCAL_ARRANGEMENT_OPTIONS } from '../../../services/localOrganizer';

const STRATEGY_LABEL = LOCAL_ARRANGEMENT_OPTIONS.reduce<Record<string, string>>(
  (acc, opt) => ({ ...acc, [opt.value]: opt.label }),
  {},
);

const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—';
  const units = ['o', 'Ko', 'Mo', 'Go'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[unitIndex]}`;
};

const formatDate = (epochMs: number): string => {
  if (!Number.isFinite(epochMs) || epochMs <= 0) return '—';
  try {
    return new Date(epochMs).toLocaleString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return new Date(epochMs).toISOString().slice(0, 16).replace('T', ' ');
  }
};

const buildFullPath = (run: LocalLibraryRun, file: LocalLibraryFileEntry): string => {
  const segments: string[] = [];
  if (run.destination) segments.push(run.destination);
  if (run.wrapper) segments.push(run.wrapper);
  if (file.folder_path) segments.push(file.folder_path);
  return segments.join(' / ');
};

/** Chemin relatif affiché dans la liste du manifeste (dossier + nom). */
const manifestRelativePath = (file: LocalLibraryFileEntry): string =>
  file.folder_path ? `${file.folder_path}/${file.name}` : file.name;

const escapeCsvCell = (value: string): string => {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
};

const buildRunManifestPlainText = (run: LocalLibraryRun): string =>
  run.files.map((f) => manifestRelativePath(f)).join('\n');

const buildRunManifestCsv = (run: LocalLibraryRun): string => {
  const header = 'chemin_relatif,taille_octets';
  const rows = run.files.map(
    (f) => `${escapeCsvCell(manifestRelativePath(f))},${Number.isFinite(f.size) ? f.size : 0}`,
  );
  return [header, ...rows].join('\r\n');
};

const slugForManifestExport = (run: LocalLibraryRun): string => {
  const raw = run.destination
    .trim()
    // eslint-disable-next-line no-control-regex
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/\s+/g, '_');
  const s = raw.replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 48);
  return s || `manifest_${run.id.replace(/-/g, '').slice(0, 12)}`;
};

const downloadManifestFile = (run: LocalLibraryRun, kind: 'text' | 'csv'): void => {
  if (run.files.length === 0) return;
  const body = kind === 'csv' ? buildRunManifestCsv(run) : buildRunManifestPlainText(run);
  const mime = kind === 'csv' ? 'text/csv;charset=utf-8' : 'text/plain;charset=utf-8';
  const ext = kind === 'csv' ? '.csv' : '.txt';
  const blob = new Blob([body], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${slugForManifestExport(run)}_liste${ext}`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

const RunBadge: React.FC<{ run: LocalLibraryRun }> = ({ run }) => (
  <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-600">
    <span
      className="material-symbols-outlined text-[14px]"
      aria-hidden
    >
      {run.mode === 'fsa' ? 'folder_managed' : 'folder_zip'}
    </span>
    {run.mode === 'fsa' ? 'Poste' : 'ZIP'}
  </span>
);

const SearchResultRow: React.FC<{ hit: LocalLibrarySearchHit; query: string }> = ({ hit, query }) => {
  const tokens = useMemo(
    () =>
      query
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .split(/\s+/)
        .filter(Boolean),
    [query],
  );

  const highlight = (text: string) => {
    if (tokens.length === 0) return text;
    const norm = text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    // On souligne le premier match trouvé pour donner un repère visuel sans
    // surcharger le rendu (highlights multiples = bruit visuel).
    for (const token of tokens) {
      const idx = norm.indexOf(token);
      if (idx >= 0) {
        return (
          <>
            {text.slice(0, idx)}
            <mark className="rounded bg-amber-100 px-0.5 font-semibold text-amber-900">
              {text.slice(idx, idx + token.length)}
            </mark>
            {text.slice(idx + token.length)}
          </>
        );
      }
    }
    return text;
  };

  return (
    <li className="group rounded-2xl border border-slate-200 bg-white px-5 py-4 transition-shadow hover:shadow-md">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="flex items-start gap-2 text-sm font-bold text-slate-800 break-all">
            <span className="material-symbols-outlined text-[18px] mt-0.5 text-slate-400 shrink-0" aria-hidden>
              draft
            </span>
            <span>{highlight(hit.file.name)}</span>
          </p>
          <p className="flex items-start gap-2 font-mono text-[11px] text-slate-500 break-all">
            <span className="material-symbols-outlined text-[14px] mt-0.5 text-slate-300 shrink-0" aria-hidden>
              folder_open
            </span>
            <span>{highlight(buildFullPath(hit.run, hit.file))}</span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-[11px] text-slate-500">
          <RunBadge run={hit.run} />
          <span>{formatBytes(hit.file.size)}</span>
          <span aria-hidden>•</span>
          <span>{formatDate(hit.run.created_at)}</span>
        </div>
      </div>
    </li>
  );
};

const RunCard: React.FC<{
  run: LocalLibraryRun;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onRelaunch: () => void;
  storageHint?: string;
}> = ({ run, expanded, onToggle, onDelete, onRelaunch, storageHint }) => {
  const strategyLabel = STRATEGY_LABEL[run.strategy] || run.strategy;
  const exportDetailsRef = useRef<HTMLDetailsElement>(null);

  const closeExportMenu = () => {
    if (exportDetailsRef.current) exportDetailsRef.current.open = false;
  };

  return (
    <article className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-start gap-3 text-left"
        >
          <span
            className="material-symbols-outlined mt-0.5 text-slate-400 transition-transform"
            aria-hidden
            style={{ transform: expanded ? 'rotate(90deg)' : 'none' }}
          >
            chevron_right
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="flex items-center gap-2 text-sm font-bold text-slate-800">
              <span className="material-symbols-outlined text-[18px] text-rdpc-blue" aria-hidden>
                {run.mode === 'fsa' ? 'folder_managed' : 'folder_zip'}
              </span>
              <span className="truncate">{run.destination || '—'}</span>
              {run.wrapper ? (
                <span className="truncate text-slate-500">/ {run.wrapper}</span>
              ) : null}
            </p>
            <p className="text-[11px] text-slate-500 flex flex-wrap items-center gap-2">
              <span>
                {formatDate(run.created_at)} · {strategyLabel}
              </span>
              {storageHint ? (
                <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 font-black uppercase tracking-wider text-[9px] text-blue-700">
                  {storageHint}
                </span>
              ) : null}
            </p>
          </div>
        </button>
        <div className="flex shrink-0 items-center gap-3 text-[11px] font-bold text-slate-600">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 uppercase tracking-widest">
            <span className="material-symbols-outlined text-[14px]" aria-hidden>folder</span>
            {run.total_folders} dossier{run.total_folders > 1 ? 's' : ''}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 uppercase tracking-widest">
            <span className="material-symbols-outlined text-[14px]" aria-hidden>description</span>
            {run.total_files} fichier{run.total_files > 1 ? 's' : ''}
          </span>
          {run.files_unranged > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 uppercase tracking-widest text-amber-700">
              <span className="material-symbols-outlined text-[14px]" aria-hidden>flag</span>
              {run.files_unranged} à arbitrer
            </span>
          ) : null}
          <details
            ref={exportDetailsRef}
            className={`relative ${run.files.length === 0 ? 'pointer-events-none opacity-40' : ''}`}
          >
            <summary
              className="list-none flex cursor-pointer items-center justify-center rounded-full border border-slate-200 p-1.5 text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 [&::-webkit-details-marker]:hidden"
              aria-label="Télécharger la liste du manifeste"
              aria-haspopup="menu"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden>download</span>
            </summary>
            <div
              role="menu"
              className="absolute right-0 top-full z-20 mt-1 min-w-[220px] rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
            >
              <button
                type="button"
                role="menuitem"
                disabled={run.files.length === 0}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                onClick={() => {
                  downloadManifestFile(run, 'text');
                  closeExportMenu();
                }}
              >
                <span className="material-symbols-outlined text-[16px] text-slate-400" aria-hidden>subject</span>
                Liste texte (.txt)
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={run.files.length === 0}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                onClick={() => {
                  downloadManifestFile(run, 'csv');
                  closeExportMenu();
                }}
              >
                <span className="material-symbols-outlined text-[16px] text-slate-400" aria-hidden>table_chart</span>
                Tableau CSV (.csv)
              </button>
            </div>
          </details>
          <Tooltip
            side="bottom"
            align="right"
            content={
              <span>Règles à jour. Copie disque : sans étape 1 si ce navigateur a encore le dossier du rangement. Sinon → étape 1.</span>
            }
          >
            <span className="inline-flex">
              <button
                type="button"
                disabled={run.files.length === 0}
                onClick={onRelaunch}
                aria-label="Relancer le classement"
                className="rounded-full border border-slate-200 p-1.5 text-slate-600 transition-colors hover:border-rdpc-blue/40 hover:bg-blue-50/80 hover:text-rdpc-blue disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-[18px]" aria-hidden>published_with_changes</span>
              </button>
            </span>
          </Tooltip>
          <button
            type="button"
            onClick={onDelete}
            title={
              storageHint
                ? 'Effacer la copie sur le serveur (les fichiers sur votre poste ne sont pas supprimés)'
                : 'Retirer ce rangement du navigateur (les fichiers locaux ne sont pas supprimés)'
            }
            className="rounded-full border border-slate-200 p-1.5 text-slate-400 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
            aria-label="Retirer ce rangement"
          >
            <span className="material-symbols-outlined text-[16px]" aria-hidden>delete</span>
          </button>
        </div>
      </header>
      {expanded ? (
        <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-4">
          <ul className="space-y-1.5 text-[12px]">
            {run.files.slice(0, 200).map((file, idx) => (
              <li key={`${run.id}_${idx}`} className="flex items-start gap-2">
                <span className="material-symbols-outlined text-[14px] mt-0.5 text-slate-300 shrink-0" aria-hidden>
                  insert_drive_file
                </span>
                <span className="font-mono text-slate-600 break-all">
                  {file.folder_path ? `${file.folder_path}/` : ''}
                  <span className="font-bold text-slate-800">{file.name}</span>
                  <span className="ml-2 text-slate-400">{formatBytes(file.size)}</span>
                </span>
              </li>
            ))}
            {run.files.length > 200 ? (
              <li className="pt-2 text-[11px] italic text-slate-400">
                … et {run.files.length - 200} fichiers supplémentaires (utilisez la recherche pour les retrouver)
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </article>
  );
};

const LocalLibraryPage: React.FC = () => {
  const navigate = useNavigate();
  const [runs, setRuns] = useState<LocalLibraryRun[]>([]);
  const [serverRun, setServerRun] = useState<LocalLibraryRun | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<
    | { kind: 'delete-run'; runId: string; runLabel: string }
    | { kind: 'clear-all' }
    | { kind: 'clear-server' }
    | null
  >(null);

  const available = isLocalLibraryAvailable();

  const reload = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const env = await api.getLocalArrangementSnapshot().catch(() => ({ snapshot: null }));
      setServerRun(env.snapshot);

      if (!isLocalLibraryAvailable()) {
        setRuns([]);
      } else {
        try {
          const items = await listLibraryRuns();
          setRuns(items);
        } catch (idbErr) {
          console.warn('IndexedDB bibliothèque locale :', idbErr);
          setRuns([]);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de charger la bibliothèque.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const deviceRuns = useMemo(
    () => runs.filter((r) => !serverRun || r.id !== serverRun.id),
    [runs, serverRun],
  );

  const combinedRuns = useMemo(() => {
    const list: LocalLibraryRun[] = [];
    if (serverRun) list.push(serverRun);
    for (const r of deviceRuns) {
      list.push(r);
    }
    return list;
  }, [serverRun, deviceRuns]);

  const searchHits = useMemo(
    () => searchLocalLibrary(combinedRuns, query),
    [combinedRuns, query],
  );

  const totalFiles = useMemo(
    () => combinedRuns.reduce((sum, run) => sum + run.total_files, 0),
    [combinedRuns],
  );

  const hasAnyContent = combinedRuns.length > 0;

  const handleDeleteRun = async (runId: string) => {
    try {
      await deleteLibraryRun(runId);
      await reload();
      if (expandedRunId === runId) setExpandedRunId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Suppression impossible.');
    } finally {
      setConfirmation(null);
    }
  };

  const handleClearAll = async () => {
    try {
      await clearLocalLibrary();
      await reload();
      setExpandedRunId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Effacement impossible.');
    } finally {
      setConfirmation(null);
    }
  };

  const handleClearServer = async () => {
    try {
      await api.deleteLocalArrangementSnapshot();
      await reload();
      setExpandedRunId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Suppression serveur impossible.');
    } finally {
      setConfirmation(null);
    }
  };

  const isSearching = query.trim().length > 0;

  return (
    <div className="p-8 pb-8 flex flex-col h-full min-h-0 animate-in fade-in duration-500">
      <header className="mb-6 shrink-0">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-wrap items-start gap-x-3 gap-y-2 min-w-0">
            <h1 className="text-4xl font-black text-slate-800 tracking-tighter uppercase italic flex items-center gap-3 min-w-0">
              <span className="material-symbols-outlined text-4xl text-rdpc-blue shrink-0">local_library</span>
              <span className="break-words">Bibliothèque locale</span>
            </h1>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void reload()}
              disabled={isLoading}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black uppercase tracking-widest text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
            >
              <span className={`material-symbols-outlined text-[18px] ${isLoading ? 'animate-spin' : ''}`} aria-hidden>refresh</span>
              Actualiser
            </button>
            <button
              type="button"
              onClick={() => setConfirmation({ kind: 'clear-all' })}
              disabled={runs.length === 0}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black uppercase tracking-widest text-slate-700 transition-colors hover:bg-red-50 hover:border-red-200 hover:text-red-600 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden>delete_sweep</span>
              Effacer l&apos;historique navigateur
            </button>
            <button
              type="button"
              onClick={() => setConfirmation({ kind: 'clear-server' })}
              disabled={!serverRun}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black uppercase tracking-widest text-slate-700 transition-colors hover:bg-red-50 hover:border-red-200 hover:text-red-600 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden>cloud_off</span>
              Effacer la copie compte
            </button>
            <Link
              to="/ingestion"
              className="inline-flex items-center gap-2 rounded-2xl bg-rdpc-blue px-4 py-2.5 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-blue-200 transition-colors hover:bg-black"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden>folder_managed</span>
              Ranger des fichiers
            </Link>
          </div>
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-500">
          Retrouvez où vous avez rangé vos fichiers sur votre poste : recherche par nom ou par chemin.
          Le dernier rangement est aussi enregistré sur votre compte pour le retrouver depuis un autre appareil ;
          l&apos;historique détaillé multi-session reste dans ce navigateur (IndexedDB).
        </p>
        {!available ? (
          <p className="mt-2 max-w-3xl rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs text-amber-900">
            IndexedDB est indisponible : l&apos;historique « sur cet appareil » ne peut pas être conservé ici. Le dernier rangement synchronisé sur votre compte reste visible si vous en avez un.
          </p>
        ) : null}
      </header>

      <div className="mb-6 shrink-0">
        <label htmlFor="library-search" className="block text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2">
          Rechercher dans la bibliothèque
        </label>
        <div className="relative">
          <span
            className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            aria-hidden
          >
            search
          </span>
          <input
            id="library-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Domaine, activité, année, nom de fichier…"
            className="w-full rounded-2xl border border-slate-200 bg-white py-3.5 pl-12 pr-12 text-sm text-slate-800 placeholder:text-slate-400 focus:border-rdpc-blue focus:outline-none focus:ring-2 focus:ring-rdpc-blue/20"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Effacer la recherche"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden>close</span>
            </button>
          ) : null}
        </div>
        <p className="mt-2 text-[11px] text-slate-400">
          {isSearching
            ? `${searchHits.length} résultat${searchHits.length > 1 ? 's' : ''} sur ${totalFiles} fichiers indexés`
            : `${combinedRuns.length} vue${combinedRuns.length > 1 ? 's' : ''} · ${totalFiles} fichier${totalFiles > 1 ? 's' : ''} au total`}
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-2 focus:outline-none">
        {error ? (
          <div className="rounded-[2rem] border border-red-100 bg-red-50 px-6 py-10 text-center">
            <p className="text-base font-bold text-red-600">{error}</p>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <span className="material-symbols-outlined text-2xl animate-spin mr-3">progress_activity</span>
            Chargement de la bibliothèque…
          </div>
        ) : !hasAnyContent ? (
          <div className="rounded-[2rem] border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
            <span className="material-symbols-outlined text-5xl text-slate-300" aria-hidden>auto_stories</span>
            <p className="mt-4 text-base font-bold text-slate-700">Aucun rangement enregistré pour le moment.</p>
            <p className="mt-2 mx-auto max-w-md text-sm text-slate-500">
              Lancez un rangement depuis « Ranger / Importer », option « Ranger sur mon poste ». Après chaque opération, le catalogue est mis à jour sur ce navigateur et le dernier lot est copié sur votre compte.
            </p>
            <Link
              to="/ingestion"
              className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-rdpc-blue px-4 py-2.5 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-blue-200 transition-colors hover:bg-black"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden>folder_managed</span>
              Ouvrir le ranger
            </Link>
          </div>
        ) : isSearching ? (
          searchHits.length === 0 ? (
            <Empty icon="search_off" msg={`Aucun fichier ne correspond à « ${query.trim()} ».`} />
          ) : (
            <ul className="space-y-2">
              {searchHits.map((hit, idx) => (
                <SearchResultRow key={`${hit.run.id}_${hit.file.name}_${idx}`} hit={hit} query={query} />
              ))}
            </ul>
          )
        ) : (
          <div className="space-y-8">
            {serverRun ? (
              <section aria-labelledby="library-account-heading">
                <h2 id="library-account-heading" className="mb-3 text-[11px] font-black uppercase tracking-widest text-slate-400">
                  Dernier rangement (votre compte)
                </h2>
                <RunCard
                  run={serverRun}
                  expanded={expandedRunId === serverRun.id}
                  onToggle={() =>
                    setExpandedRunId((prev) => (prev === serverRun.id ? null : serverRun.id))
                  }
                  onDelete={() => setConfirmation({ kind: 'clear-server' })}
                  onRelaunch={() =>
                    navigate('/ingestion', {
                      state: {
                        localReplayFromLibrary: {
                          runId: serverRun.id,
                          mode: serverRun.mode,
                          strategy: serverRun.strategy,
                          files: serverRun.files.map((f) => ({
                            name: f.name,
                            last_modified: f.last_modified,
                          })),
                        },
                      },
                    })
                  }
                  storageHint="Compte"
                />
              </section>
            ) : null}

            {deviceRuns.length > 0 ? (
              <section aria-labelledby="library-device-heading">
                <h2 id="library-device-heading" className="mb-3 text-[11px] font-black uppercase tracking-widest text-slate-400">
                  Historique sur cet appareil
                </h2>
                <div className="space-y-3">
                  {deviceRuns.map((run) => (
                    <RunCard
                      key={run.id}
                      run={run}
                      expanded={expandedRunId === run.id}
                      onToggle={() => setExpandedRunId((prev) => (prev === run.id ? null : run.id))}
                      onDelete={() =>
                        setConfirmation({
                          kind: 'delete-run',
                          runId: run.id,
                          runLabel: run.destination || formatDate(run.created_at),
                        })
                      }
                      onRelaunch={() =>
                        navigate('/ingestion', {
                          state: {
                            localReplayFromLibrary: {
                              runId: run.id,
                              mode: run.mode,
                              strategy: run.strategy,
                              files: run.files.map((f) => ({
                                name: f.name,
                                last_modified: f.last_modified,
                              })),
                            },
                          },
                        })
                      }
                    />
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        )}
      </div>

      {confirmation?.kind === 'delete-run' ? (
        <ConfirmationModal
          open
          icon="delete"
          eyebrow="Bibliothèque locale"
          title="Retirer ce rangement du navigateur ?"
          message={`Le rangement « ${confirmation.runLabel} » disparaîtra de l'historique IndexedDB. Les fichiers réels sur votre poste ne sont pas touchés.`}
          confirmLabel="Retirer"
          onConfirm={() => void handleDeleteRun(confirmation.runId)}
          onCancel={() => setConfirmation(null)}
        />
      ) : null}
      {confirmation?.kind === 'clear-all' ? (
        <ConfirmationModal
          open
          icon="delete_sweep"
          eyebrow="Bibliothèque locale"
          title="Effacer l'historique sur cet appareil ?"
          message="Tous les rangements mémorisés dans ce navigateur seront retirés. La copie « dernier rangement » sur votre compte n'est pas supprimée."
          confirmLabel="Effacer"
          onConfirm={() => void handleClearAll()}
          onCancel={() => setConfirmation(null)}
        />
      ) : null}
      {confirmation?.kind === 'clear-server' ? (
        <ConfirmationModal
          open
          icon="cloud_off"
          eyebrow="Bibliothèque locale"
          title="Effacer la copie sur votre compte ?"
          message="Le dernier manifeste synchronisé sera supprimé du serveur. L'historique IndexedDB sur cet appareil reste inchangé."
          confirmLabel="Effacer la copie"
          onConfirm={() => void handleClearServer()}
          onCancel={() => setConfirmation(null)}
        />
      ) : null}
    </div>
  );
};

export default LocalLibraryPage;
