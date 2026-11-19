import React, { useCallback, useEffect, useRef, useState } from 'react';

import { api } from '../services/api';
import type { Document, Tenant } from '../types';
import { useCan } from '../hooks/useCan';
import {
  RESTORE_IN_INSTITUTION_HELP,
  RESTORE_RESERVED_HELP,
  canEmptyTrash,
  isGoneFromTrash,
  isPurgeProtected,
  isRestoreReservedToAdmin,
} from '../lib/trashRules';
import { useAuthStore } from '../stores/authStore';
import { InlineHelpButton } from './ui/InlineHelpButton';

const PAGE_SIZE = 50;

type Confirm = { title: string; message: string; label: string; run: () => Promise<void> } | null;

/**
 * Corbeille : documents supprimés de l'utilisateur (ou de sa portée), restauration,
 * et — seulement si le serveur accorde `documents:purge` — suppression définitive.
 * Super-administrateur (`tenants:manage`) : sa propre corbeille est vide, il choisit donc
 * l'institution dont il consulte, efface ou vide la corbeille.
 */
const TrashPage: React.FC = () => {
  const [items, setItems] = useState<Document[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantId, setTenantId] = useState('');
  const {
    'documents:purge': canPurge,
    'documents:delete': canDelete,
    'tenants:manage': picksInstitution,
  } = useCan('documents:purge', 'documents:delete', 'tenants:manage');
  const myUserId = useAuthStore((s) => s.userProfile?.userId);
  const tenantName = tenants.find((t) => t.id === tenantId)?.name ?? '';
  const awaitingInstitution = picksInstitution && !tenantId;

  useEffect(() => {
    if (!picksInstitution) return;
    api.getTenants().then((data: Tenant[]) => setTenants(data)).catch(() => setTenants([]));
  }, [picksInstitution]);

  // Seule la dernière lecture lancée compte : une réponse plus ancienne arrivée après est ignorée.
  const loadSeq = useRef(0);

  const load = useCallback(async (append = false, skip = 0) => {
    loadSeq.current += 1;
    const mine = loadSeq.current;
    if (awaitingInstitution) {
      setItems([]);
      setTotal(0);
      setLoadError(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const page = await api.getTrashPage(skip, PAGE_SIZE, tenantId || undefined);
      if (mine !== loadSeq.current) return;
      setItems((current) => (append ? [...current, ...page.items] : page.items));
      setTotal(page.total);
      setLoadError(false);
    } catch {
      // Détail déjà affiché par le bus global ; ici on évite seulement un faux « vide ».
      if (mine === loadSeq.current && !append) setLoadError(true);
    } finally {
      if (mine === loadSeq.current) setLoading(false);
    }
  }, [awaitingInstitution, tenantId]);

  useEffect(() => {
    load();
  }, [load]);

  const removeLocally = (id: string) => {
    setItems((current) => current.filter((d) => d.id !== id));
    setTotal((t) => Math.max(t - 1, 0));
  };

  const restore = async (doc: Document) => {
    setBusy(true);
    try {
      await api.restoreDocument(doc.id);
      removeLocally(doc.id);
    } catch (error) {
      // Message déjà affiché par le bus global ; un 404 retire en plus la ligne disparue.
      if (isGoneFromTrash(error)) removeLocally(doc.id);
    } finally {
      setBusy(false);
    }
  };

  const askPurge = (doc: Document) =>
    setConfirm({
      title: 'Supprimer définitivement ?',
      message: `« ${doc.title} » sera effacé. Impossible de revenir en arrière.`,
      label: 'Supprimer',
      run: async () => {
        try {
          await api.purgeDocument(doc.id, tenantId || undefined);
        } catch (error) {
          if (!isGoneFromTrash(error)) throw error;
        }
        removeLocally(doc.id);
      },
    });

  const askEmpty = () =>
    setConfirm({
      title: 'Vider la corbeille ?',
      message: `Les documents${tenantName ? ` de ${tenantName}` : ''} seront effacés, sauf ceux signés ou archivés. Impossible de revenir en arrière.`,
      label: 'Vider',
      run: async () => {
        // Le serveur purge par lots : on rappelle tant qu'il en reste. `remaining` ne compte que
        // ce qu'un nouvel appel purgerait (signés et archivés exclus) ; un lot vide arrête aussi.
        try {
          for (let guard = 0; guard < 100; guard += 1) {
            // Séquentiel voulu : chaque appel dépend du reste laissé par le précédent.
            // eslint-disable-next-line no-await-in-loop
            const { purged, remaining } = await api.emptyTrash(tenantId || undefined);
            if (remaining <= 0 || purged === 0) break;
          }
        } finally {
          // Lot en échec : les lots précédents sont déjà effacés, la liste doit le montrer.
          await load();
        }
      },
    });

  const runConfirm = async () => {
    if (!confirm) return;
    const { run } = confirm;
    setConfirm(null);
    setBusy(true);
    try {
      await run();
    } catch {
      /* bus global */
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-8 animate-in fade-in duration-500">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Corbeille</h1>
          {!loadError && (
            <span data-testid="trash-count" className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
              {total}
            </span>
          )}
          <InlineHelpButton
            label="Aide sur la corbeille"
            content={
              picksInstitution
                ? `Choisissez une institution pour voir sa corbeille. ${RESTORE_IN_INSTITUTION_HELP}`
                : 'Les documents supprimés arrivent ici. Restaurez-les pour les remettre à leur place.'
            }
          />
          {picksInstitution && (
            <select
              aria-label="Institution"
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              disabled={busy}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:opacity-50"
            >
              <option value="">Choisir une institution…</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}
        </div>
        {canPurge && !awaitingInstitution && canEmptyTrash(items, total) && (
          <button
            type="button"
            onClick={askEmpty}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-2xl bg-red-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden>delete_forever</span>
            Vider la corbeille
          </button>
        )}
      </header>

      {loadError && (
        <div role="alert" className="rounded-[2rem] border border-red-100 bg-red-50 p-10 text-center">
          <p className="text-sm font-medium text-red-700">Corbeille indisponible pour le moment.</p>
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

      {!loadError && (!loading && items.length === 0 ? (
        <div className="rounded-[2rem] border border-slate-100 bg-white p-10 text-center">
          <span className="material-symbols-outlined text-4xl text-slate-300" aria-hidden>delete</span>
          <p className="mt-2 text-sm font-medium text-slate-500">
            {awaitingInstitution ? 'Choisissez une institution pour voir sa corbeille.' : 'La corbeille est vide.'}
          </p>
        </div>
      ) : (
        <ul aria-label="Documents dans la corbeille" className="divide-y divide-slate-100 rounded-[2rem] border border-slate-100 bg-white">
          {items.map((doc) => (
            <li key={doc.id} className="flex items-center gap-4 px-6 py-4">
              <span className="material-symbols-outlined text-slate-400" aria-hidden>description</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-800">{doc.title}</p>
                {doc.logical_space_path && (
                  <p className="truncate text-xs text-slate-500">{doc.logical_space_path}</p>
                )}
              </div>
              {tenantId ? null : isRestoreReservedToAdmin(doc, myUserId, Boolean(canDelete)) ? (
                <span
                  role="img"
                  aria-label={`${doc.title} : ${RESTORE_RESERVED_HELP}`}
                  title={RESTORE_RESERVED_HELP}
                  className="material-symbols-outlined p-2 text-slate-300"
                >
                  restore_from_trash
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => restore(doc)}
                  disabled={busy}
                  aria-label={`Restaurer ${doc.title}`}
                  title="Restaurer"
                  className="rounded-xl p-2 text-slate-500 hover:bg-blue-50 hover:text-rdpc-blue disabled:opacity-50"
                >
                  <span className="material-symbols-outlined" aria-hidden>restore_from_trash</span>
                </button>
              )}
              {canPurge && isPurgeProtected(doc) && (
                <span
                  role="img"
                  aria-label={`${doc.title} : signé ou archivé, ne peut pas être effacé`}
                  title="Signé ou archivé : ne peut pas être effacé"
                  className="material-symbols-outlined p-2 text-slate-300"
                >
                  lock
                </span>
              )}
              {canPurge && !isPurgeProtected(doc) && (
                <button
                  type="button"
                  onClick={() => askPurge(doc)}
                  disabled={busy}
                  aria-label={`Supprimer définitivement ${doc.title}`}
                  title="Supprimer définitivement"
                  className="rounded-xl p-2 text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined" aria-hidden>delete_forever</span>
                </button>
              )}
            </li>
          ))}
        </ul>
      ))}

      {items.length < total && (
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => load(true, items.length)}
            disabled={loading}
            className="rounded-2xl bg-slate-100 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 disabled:opacity-50"
          >
            Afficher plus
          </button>
        </div>
      )}

      {confirm && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm" role="presentation">
          <div role="alertdialog" aria-modal="true" aria-labelledby="trash-confirm-title" className="w-full max-w-md rounded-[2rem] bg-white p-8 shadow-2xl">
            <h2 id="trash-confirm-title" className="text-lg font-black text-slate-800">{confirm.title}</h2>
            <p className="mt-2 text-sm text-slate-500">{confirm.message}</p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                autoFocus
                onClick={() => setConfirm(null)}
                className="flex-1 rounded-2xl bg-slate-100 py-3 text-xs font-black uppercase tracking-widest text-slate-600 hover:bg-slate-200"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => runConfirm()}
                className="flex-1 rounded-2xl bg-red-600 py-3 text-xs font-black uppercase tracking-widest text-white hover:bg-red-700"
              >
                {confirm.label}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrashPage;
