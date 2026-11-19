import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { duplicatesApi } from '../services';
import type { DuplicateGroup } from '../services/resources/duplicates.api';
import { formatDate, formatFileSize } from '../types';
import { InlineHelpButton } from './ui/InlineHelpButton';

const PAGE_SIZE = 20;
/** Plafond `limit` de GET /duplicates (backend : le=100). */
const MAX_PAGE = 100;

/**
 * Doublons (#171) : fichiers identiques enregistrés plusieurs fois. L'utilisateur choisit la
 * copie à garder (l'original par défaut) ; les autres vont à la corbeille, d'où on peut les
 * restaurer. Le périmètre et les droits viennent du serveur.
 */
const DuplicatesPage: React.FC = () => {
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [keep, setKeep] = useState<Record<string, string>>({});
  const [done, setDone] = useState<number | null>(null);
  const [loadError, setLoadError] = useState(false);
  const requestSeq = useRef(0);

  const load = useCallback(async (append = false, skip = 0, limit = PAGE_SIZE) => {
    requestSeq.current += 1;
    const seq = requestSeq.current;
    setLoading(true);
    try {
      const page = await duplicatesApi.getDuplicateGroups(skip, limit);
      if (seq !== requestSeq.current) return;
      setGroups((current) => (append ? [...current, ...page.groups] : page.groups));
      setTotal(page.total);
      setLoadError(false);
    } catch {
      // Détail déjà affiché par le bus global ; ici on évite seulement un faux « Aucun doublon ».
      if (seq === requestSeq.current && !append) setLoadError(true);
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const resolve = async (group: DuplicateGroup) => {
    const keepId = keep[group.checksum] ?? group.suggested_keep_id;
    const trashIds = group.documents.map((d) => d.id).filter((id) => id !== keepId);
    setBusy(group.checksum);
    setDone(null);
    try {
      const result = await duplicatesApi.resolveDuplicates(keepId, trashIds);
      setGroups((current) => current.filter((g) => g.checksum !== group.checksum));
      setTotal((t) => Math.max(t - 1, 0));
      setDone(result.trashed.length + result.already_trashed.length);
    } catch {
      // Message affiché par le bus. Le groupe a pu changer entre-temps : on relit la liste,
      // sur autant de groupes que ceux déjà affichés (« Afficher plus » compris).
      await load(false, 0, Math.min(Math.max(groups.length, PAGE_SIZE), MAX_PAGE));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="p-8 animate-in fade-in duration-500">
      <header className="mb-6 flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-black tracking-tight text-slate-900">Doublons</h1>
        {!loadError && (
          <span data-testid="duplicates-count" className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
            {total}
          </span>
        )}
        <InlineHelpButton
          label="Aide sur les doublons"
          content="Le même fichier enregistré plusieurs fois. Gardez une copie : les autres vont à la corbeille."
        />
      </header>

      {done !== null && (
        <p role="status" className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          <span className="material-symbols-outlined text-[18px]" aria-hidden>check_circle</span>
          {done > 1 ? `${done} copies mises à la corbeille.` : '1 copie mise à la corbeille.'}
          <Link to="/trash" className="font-bold underline">Voir la corbeille</Link>
        </p>
      )}

      {loadError && (
        <div role="alert" className="rounded-[2rem] border border-red-100 bg-red-50 p-10 text-center">
          <p className="text-sm font-medium text-red-700">Doublons indisponibles pour le moment.</p>
          <button
            type="button"
            onClick={() => load()}
            disabled={loading}
            className="mt-4 rounded-2xl bg-white px-4 py-2 text-xs font-bold text-red-700 hover:bg-red-100 disabled:opacity-50"
          >
            Réessayer
          </button>
        </div>
      )}

      {!loadError && (!loading && groups.length === 0 ? (
        <div className="rounded-[2rem] border border-slate-100 bg-white p-10 text-center">
          <span className="material-symbols-outlined text-4xl text-slate-300" aria-hidden>content_copy</span>
          <p className="mt-2 text-sm font-medium text-slate-500">Aucun doublon.</p>
        </div>
      ) : (
        <ul aria-label="Groupes de doublons" className="space-y-4">
          {groups.map((group) => {
            const keepId = keep[group.checksum] ?? group.suggested_keep_id;
            const name = group.documents[0]?.title ?? '';
            return (
              <li
                key={group.checksum}
                aria-label={`Doublons de ${name}`}
                className="rounded-[2rem] border border-slate-100 bg-white p-6"
              >
                <fieldset disabled={busy !== null}>
                  <legend className="mb-3 text-xs font-black uppercase tracking-widest text-slate-500">
                    Choisissez la copie à garder
                  </legend>
                  <div className="space-y-2">
                    {group.documents.map((doc) => {
                      const meta = [doc.org_unit_name, doc.owner_name, formatDate(doc.created_at), formatFileSize(doc.file_size ?? null)]
                        .filter(Boolean)
                        .join(' · ');
                      return (
                        <label
                          key={doc.id}
                          className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 ${
                            keepId === doc.id ? 'border-rdpc-blue bg-blue-50/40' : 'border-slate-100 hover:bg-slate-50'
                          }`}
                        >
                          <input
                            type="radio"
                            name={`keep-${group.checksum}`}
                            value={doc.id}
                            checked={keepId === doc.id}
                            onChange={() => setKeep((k) => ({ ...k, [group.checksum]: doc.id }))}
                            className="mt-1"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2">
                              <span className="truncate text-sm font-bold text-slate-800">{doc.title}</span>
                              {doc.id === group.suggested_keep_id && (
                                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                                  Original
                                </span>
                              )}
                            </span>
                            <span className="block truncate text-xs text-slate-500">{meta}</span>
                            {doc.logical_space_path && (
                              <span className="block truncate text-xs text-slate-500">{doc.logical_space_path}</span>
                            )}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={() => resolve(group)}
                      className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-700 disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-[18px]" aria-hidden>delete_sweep</span>
                      {busy === group.checksum ? 'En cours…' : 'Mettre les autres à la corbeille'}
                    </button>
                  </div>
                </fieldset>
              </li>
            );
          })}
        </ul>
      ))}

      {groups.length < total && (
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => load(true, groups.length)}
            disabled={loading}
            className="rounded-2xl bg-slate-100 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 disabled:opacity-50"
          >
            Afficher plus
          </button>
        </div>
      )}
    </div>
  );
};

export default DuplicatesPage;
