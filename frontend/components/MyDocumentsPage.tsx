import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { documentsApi, myDocumentsApi } from '../services';
import type { MyDocument, MyDocumentsList, SharedReason } from '../services/resources/myDocuments.api';
import { Document, formatDate } from '../types';
import DocumentDetailModal from './DocumentDetailModal';
import { ConfirmationModal } from './ui/ConfirmationModal';
import { InlineHelpButton } from './ui/InlineHelpButton';

const PAGE_SIZE = 20;

type Tab = { id: MyDocumentsList; label: string; empty: string };

const FAVORITES_TAB: Tab = {
  id: 'favorites',
  label: 'Favoris',
  empty: 'Aucun favori. Cliquez sur l’étoile d’un document pour l’ajouter.',
};

const TABS: Tab[] = [
  FAVORITES_TAB,
  { id: 'recent', label: 'Récents', empty: 'Aucun document ouvert récemment.' },
  { id: 'shared', label: 'Partagés avec moi', empty: 'Aucun document partagé avec vous.' },
];

const SHARED_FILTERS: { id: SharedReason | 'all'; label: string }[] = [
  { id: 'all', label: 'Tous' },
  { id: 'assigned', label: 'À traiter' },
  { id: 'visible', label: 'Visibles' },
];

const isList = (value: string | null): value is MyDocumentsList =>
  value === 'favorites' || value === 'recent' || value === 'shared';

/**
 * Mes documents (#165) : favoris, récemment ouverts, partagés avec moi. Le serveur ne renvoie
 * que ce que l'agent voit ; un document mis à la corbeille disparaît des listes.
 */
const MyDocumentsPage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const tabParam = params.get('tab');
  const tab: MyDocumentsList = isList(tabParam) ? tabParam : 'favorites';
  const [reason, setReason] = useState<SharedReason | 'all'>('all');
  const [items, setItems] = useState<MyDocument[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [opened, setOpened] = useState<Document | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [loadError, setLoadError] = useState(false);
  /** Récents : le serveur ne garde pas l'historique d'ouverture (X-Recent-Tracking-Enabled: false). */
  const [trackingOff, setTrackingOff] = useState(false);
  const requestSeq = useRef(0);

  const load = useCallback(async (append = false, skip = 0) => {
    requestSeq.current += 1;
    const seq = requestSeq.current;
    setLoading(true);
    try {
      const page = await myDocumentsApi.list(tab, skip, PAGE_SIZE, reason === 'all' ? undefined : reason);
      if (seq !== requestSeq.current) return;
      setItems((current) => (append ? [...current, ...page.items] : page.items));
      setTotal(page.total);
      setTrackingOff(tab === 'recent' && page.trackingEnabled === false);
      setLoadError(false);
    } catch {
      // Détail affiché par le bus global ; sans liste, pas de faux « aucun document ».
      if (seq === requestSeq.current && !append) setLoadError(true);
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [tab, reason]);

  useEffect(() => {
    load();
  }, [load]);

  const selectTab = (next: MyDocumentsList) => {
    setReason('all');
    setParams(next === 'favorites' ? {} : { tab: next }, { replace: true });
  };

  const toggleFavorite = async (doc: MyDocument) => {
    setBusy(doc.id);
    try {
      if (doc.is_favorite) await myDocumentsApi.removeFavorite(doc.id);
      else await myDocumentsApi.addFavorite(doc.id);
      if (tab === 'favorites' && doc.is_favorite) {
        setItems((current) => current.filter((d) => d.id !== doc.id));
        setTotal((t) => Math.max(t - 1, 0));
      } else {
        setItems((current) => current.map((d) => (d.id === doc.id ? { ...d, is_favorite: !doc.is_favorite } : d)));
      }
    } catch {
      // Message affiché par le bus. Le document a pu disparaître entre-temps : on relit.
      await load();
    } finally {
      setBusy(null);
    }
  };

  const open = async (doc: MyDocument) => {
    setBusy(doc.id);
    try {
      setOpened(await documentsApi.getDocument(doc.id));
    } catch {
      await load();
    } finally {
      setBusy(null);
    }
  };

  const clearRecent = async () => {
    setConfirmClear(false);
    try {
      await myDocumentsApi.clearRecent();
      setItems([]);
      setTotal(0);
    } catch {
      /* erreur déjà affichée par le bus global */
    }
  };

  const current = TABS.find((t) => t.id === tab) ?? FAVORITES_TAB;

  return (
    <div className="p-8 animate-in fade-in duration-500">
      <header className="mb-6 flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-black tracking-tight text-slate-900">Favoris &amp; récents</h1>
        <InlineHelpButton
          label="Aide sur favoris et récents"
          content="Vos favoris, les documents que vous avez ouverts, et ceux des autres que vous pouvez consulter."
        />
      </header>

      <div role="tablist" aria-label="Listes" className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => selectTab(t.id)}
            className={`rounded-2xl px-4 py-2 text-xs font-bold ${
              tab === t.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {!loadError && (
          <span data-testid="my-documents-count" className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
            {total}
          </span>
        )}
        {tab === 'recent' && trackingOff && (
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">Suivi désactivé</span>
        )}
        {tab === 'shared' && (
          <div role="group" aria-label="Filtre" className="flex gap-1">
            {SHARED_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={reason === f.id}
                onClick={() => setReason(f.id)}
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  reason === f.id ? 'bg-blue-50 text-rdpc-blue' : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
        {tab === 'recent' && items.length > 0 && (
          <button
            type="button"
            onClick={() => setConfirmClear(true)}
            className="ml-auto rounded-2xl px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100"
          >
            Effacer l’historique
          </button>
        )}
      </div>

      {loadError && (
        <div role="alert" className="rounded-[2rem] border border-red-100 bg-red-50 p-6 text-center">
          <p className="text-sm font-bold text-red-700">Liste indisponible pour le moment.</p>
          <button
            type="button"
            onClick={() => load()}
            className="mt-3 rounded-2xl bg-white px-4 py-2 text-xs font-bold text-red-700 hover:bg-red-100"
          >
            Réessayer
          </button>
        </div>
      )}
      {!loadError && !loading && items.length === 0 && (
        <div className="rounded-[2rem] border border-slate-100 bg-white p-10 text-center">
          <span className="material-symbols-outlined text-4xl text-slate-300" aria-hidden>star</span>
          <p className="mt-2 text-sm font-medium text-slate-500">
            {tab === 'recent' && trackingOff ? 'Les documents ouverts ne sont pas mémorisés.' : current.empty}
          </p>
        </div>
      )}
      {!loadError && (loading || items.length > 0) && (
        <ul aria-label={current.label} className="divide-y divide-slate-100 rounded-[2rem] border border-slate-100 bg-white">
          {items.map((doc) => {
            const when = doc.marked_at ?? doc.updated_at;
            const meta = [doc.category_name, doc.owner_name, formatDate(when)].filter(Boolean).join(' · ');
            return (
              <li key={doc.id} aria-label={doc.title} className="flex items-center gap-3 px-5 py-3">
                <button
                  type="button"
                  aria-pressed={doc.is_favorite}
                  aria-label={doc.is_favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                  title={doc.is_favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                  disabled={busy === doc.id}
                  onClick={() => toggleFavorite(doc)}
                  className="rounded-full p-1.5 hover:bg-slate-100 disabled:opacity-50"
                >
                  <span
                    aria-hidden="true"
                    className={`material-symbols-outlined text-[20px] ${doc.is_favorite ? 'text-amber-500' : 'text-slate-300'}`}
                    style={doc.is_favorite ? { fontVariationSettings: "'FILL' 1" } : undefined}
                  >
                    star
                  </span>
                </button>
                <button
                  type="button"
                  disabled={busy === doc.id}
                  onClick={() => open(doc)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="block truncate text-sm font-bold text-slate-800 hover:text-rdpc-blue">{doc.title}</span>
                  <span className="block truncate text-xs text-slate-500">{meta}</span>
                </button>
                {doc.reason === 'assigned' && (
                  <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                    À traiter
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {!loadError && items.length < total && (
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

      <ConfirmationModal
        open={confirmClear}
        title="Effacer l’historique ?"
        message="La liste des documents ouverts sera vidée. Les documents ne sont pas touchés."
        confirmLabel="Effacer"
        onConfirm={() => clearRecent()}
        onCancel={() => setConfirmClear(false)}
      />

      {opened && <DocumentDetailModal document={opened} onClose={() => setOpened(null)} />}
    </div>
  );
};

export default MyDocumentsPage;
