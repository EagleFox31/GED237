import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../../../services/api';
import DocumentDetailModal from '../../../components/DocumentDetailModal';
import { ApiError } from '../../../lib/errors';
import { pushClientOperationError } from '../../../lib/errors/clientOperationError';
import { Document, getFileTypeLabel, formatDate, getStatusLabel } from '../../../types';
import {
  extractLibraryCategories,
  extractLibraryFormats,
  filterLibraryDocuments,
} from '../../../lib/libraryFilter';

const LibraryView: React.FC = () => {
  const [docs, setDocs] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [query, setQuery] = useState('');
  const [selectedFormat, setSelectedFormat] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  const fetchDocs = async () => {
      setIsLoading(true);
      setLoadFailed(false);
      try {
        const data = await api.getDocuments({ status: 'validated' });
        setDocs(data);
      } catch (err) {
        // Erreurs HTTP déjà au bus global ; on garde l'état d'échec pour ne pas afficher « Aucun document ».
        setLoadFailed(true);
        if (!(err instanceof ApiError)) pushClientOperationError(err, { fallbackDetail: 'Chargement de la bibliothèque impossible.' });
      } finally {
        setIsLoading(false);
      }
    };

  useEffect(() => {
    fetchDocs();
  }, []);

  const formats = useMemo(() => extractLibraryFormats(docs), [docs]);
  const categories = useMemo(() => extractLibraryCategories(docs), [docs]);
  const filteredDocs = useMemo(
    () =>
      filterLibraryDocuments(docs, {
        query,
        format: selectedFormat,
        category: selectedCategory,
      }),
    [docs, query, selectedFormat, selectedCategory],
  );
  const hasFilters = Boolean(query.trim() || selectedFormat || selectedCategory);

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-700">
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 text-slate-500 rounded-full text-[9px] font-black uppercase tracking-[0.2em] mb-3 border border-slate-200">
          Base Documentaire Officielle
        </div>
        <h2 className="text-4xl font-black text-slate-900 tracking-tighter italic uppercase">Ma <span className="text-slate-400">Bibliothèque</span></h2>
        <p className="text-slate-500 mt-1 font-medium italic">Accédez en lecture seule aux archives et documents partagés.</p>
      </div>

      <div className="glass p-10 rounded-[3rem] bg-white/60 border-white">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8 pb-8 border-b border-slate-100">
          <div className="flex items-center gap-6">
            {/* La bibliothèque ne charge que des documents validés : un seul compteur, celui de la liste affichée. */}
            <div className="text-center">
              <p className="text-2xl font-black italic">{isLoading ? '...' : filteredDocs.length}</p>
              <p className="text-[8px] font-black uppercase text-slate-400">Documents validés</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <input
              type="search"
              aria-label="Rechercher dans la bibliothèque"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher par titre ou catégorie..."
              className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700 outline-none focus:border-rdpc-blue min-w-[220px]"
            />
            {formats.length > 1 && (
              <select
                aria-label="Filtrer par format"
                value={selectedFormat}
                onChange={(e) => setSelectedFormat(e.target.value)}
                className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 outline-none focus:border-rdpc-blue"
              >
                <option value="">Tous les formats</option>
                {formats.map((fmt) => (
                  <option key={fmt} value={fmt}>{fmt}</option>
                ))}
              </select>
            )}
            {categories.length > 0 && (
              <select
                aria-label="Filtrer par catégorie"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 outline-none focus:border-rdpc-blue"
              >
                <option value="">Toutes les catégories</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            )}
            {hasFilters && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setSelectedFormat('');
                  setSelectedCategory('');
                }}
                className="px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider text-slate-500 hover:text-rdpc-blue transition-colors"
              >
                Réinitialiser
              </button>
            )}
          </div>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rdpc-blue"></div>
          </div>
        )}

        {!isLoading && loadFailed && (
          <div role="alert" className="text-center py-10 text-red-600 font-bold">
            Impossible de charger la bibliothèque.{' '}
            <button type="button" onClick={fetchDocs} className="underline">Réessayer</button>
          </div>
        )}

        {!isLoading && !loadFailed && filteredDocs.length === 0 && (
          <div className="text-center py-10 text-slate-400 font-bold">
            {hasFilters ? 'Aucun document ne correspond à votre recherche.' : 'Aucun document disponible.'}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredDocs.map((doc) => (
            <button
              type="button"
              key={doc.id}
              onClick={() => setSelectedDoc(doc)}
              aria-label={`Ouvrir ${doc.title}`}
              className="w-full text-left flex items-center gap-4 p-4 rounded-2xl bg-white border border-slate-50 hover:border-slate-200 transition-all cursor-pointer"
            >
              <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-slate-300 italic font-black text-xs">
                {getFileTypeLabel(doc.mime_type || doc.file_type)}
              </div>
              <div className="flex-1">
                <p className="text-xs font-black text-slate-800 uppercase italic">{doc.title}</p>
                <p className="text-[10px] font-bold text-slate-400">
                  {formatDate(doc.created_at)} • {getStatusLabel(doc.status)}
                  {doc.category_name ? ` • ${doc.category_name}` : ''}
                </p>
              </div>
              <span className="material-symbols-outlined text-slate-300">visibility</span>
            </button>
          ))}
        </div>
      </div>
      {selectedDoc && <DocumentDetailModal document={selectedDoc} onClose={() => setSelectedDoc(null)} />}
    </div>
  );
};

export default LibraryView;
