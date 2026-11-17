import React, { useCallback, useEffect, useState } from 'react';

import { api } from '../services/api';
import type { Document } from '../types';
import { useCan } from '../hooks/useCan';
import { InlineHelpButton } from './ui/InlineHelpButton';

const PAGE_SIZE = 50;

type Confirm = { title: string; message: string; label: string; run: () => Promise<void> } | null;

/**
 * Corbeille : documents supprimés de l'utilisateur (ou de sa portée), restauration,
 * et — seulement si le serveur accorde `documents:purge` — suppression définitive.
 */
const TrashPage: React.FC = () => {
  const [items, setItems] = useState<Document[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const { 'documents:purge': canPurge } = useCan('documents:purge');

  const load = useCallback(async (append = false, skip = 0) => {
    setLoading(true);
    try {
      const page = await api.getTrashPage(skip, PAGE_SIZE);
      setItems((current) => (append ? [...current, ...page.items] : page.items));
      setTotal(page.total);
    } catch {
      /* erreur déjà affichée par le bus global */
    } finally {
      setLoading(false);
    }
  }, []);

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
    } catch {
      /* bus global */
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
        await api.purgeDocument(doc.id);
        removeLocally(doc.id);
      },
    });

  const askEmpty = () =>
    setConfirm({
      title: 'Vider la corbeille ?',
      message: `${total} document${total > 1 ? 's' : ''} ${total > 1 ? 'seront effacés' : 'sera effacé'}. Impossible de revenir en arrière.`,
      label: 'Vider',
      run: async () => {
        // Le serveur purge par lots : on rappelle tant qu'il en reste.
        for (let guard = 0; guard < 100; guard += 1) {
          // eslint-disable-next-line no-await-in-loop -- en série : chaque appel dépend du `remaining` du précédent.
          const { remaining } = await api.emptyTrash();
          if (remaining === 0) break;
        }
        await load();
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
          <span data-testid="trash-count" className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
            {total}
          </span>
          <InlineHelpButton
            label="Aide sur la corbeille"
            content="Les documents supprimés arrivent ici. Restaurez-les pour les remettre à leur place."
          />
        </div>
        {canPurge && total > 0 && (
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

      {!loading && items.length === 0 ? (
        <div className="rounded-[2rem] border border-slate-100 bg-white p-10 text-center">
          <span className="material-symbols-outlined text-4xl text-slate-300" aria-hidden>delete</span>
          <p className="mt-2 text-sm font-medium text-slate-500">La corbeille est vide.</p>
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
              {canPurge && (
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
      )}

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
