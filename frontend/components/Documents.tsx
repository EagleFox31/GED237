// frontend/components/Documents.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

import DocumentDetailModal from './DocumentDetailModal';
import UploadDocumentModal from './UploadDocumentModal';
import { Document, DocumentCategory, formatFileSize, getFileTypeLabel, getStatusLabel, formatDate } from '../types';
import { api } from '../services/api';
import { categoriesApi } from '../services/categories.api';

const Documents: React.FC = () => {
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [docs, setDocs] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [categories, setCategories] = useState<DocumentCategory[]>([]);
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  // Recherche pilotée par l'URL (`?q=`) via la barre globale du Header.
  const [searchParams, setSearchParams] = useSearchParams();
  const searchQuery = searchParams.get('q') || '';
  const setSearchQuery = (next: string) => {
    const nextParams = new URLSearchParams(searchParams);
    if (next) nextParams.set('q', next);
    else nextParams.delete('q');
    setSearchParams(nextParams, { replace: true });
  };

  const fetchInitialData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [docsData, catsData] = await Promise.all([
        api.getDocuments(),
        categoriesApi.list()
      ]);
      setDocs(docsData);
      setCategories(catsData);
    } catch (err) {
      console.error('Failed to fetch data:', err);
      setError('Impossible de charger les données.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  const filteredDocs = docs.filter(doc => {
    const matchesSearch = !searchQuery ||
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (doc.category_name || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = !filterCategory || doc.document_category_id === filterCategory;
    const matchesStatus = !filterStatus || doc.status === filterStatus;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  const getTypeStyle = (fileType: string | null) => {
    const label = getFileTypeLabel(fileType);
    if (label === 'PDF') return 'bg-red-50 text-red-500';
    if (label === 'EXCEL') return 'bg-green-50 text-green-500';
    return 'bg-blue-50 text-blue-500';
  };

  const getTypeIcon = (fileType: string | null) => {
    const label = getFileTypeLabel(fileType);
    if (label === 'PDF') return 'description';
    if (label === 'EXCEL') return 'table_chart';
    if (label === 'IMAGE') return 'image';
    return 'draft';
  };

  const getStatusStyle = (status: string) => {
    if (status === 'validated' || status === 'signed') return 'bg-green-50 text-green-600';
    if (status === 'in_review') return 'bg-blue-50 text-blue-600';
    if (status === 'rejected') return 'bg-red-50 text-red-600';
    return 'bg-slate-50 text-slate-400';
  };

  return (
    <div className="p-8 space-y-6 animate-in slide-in-from-bottom duration-500">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-black text-slate-900 tracking-tighter italic uppercase">Explorateur <span className="text-rdpc-blue">GED</span></h2>
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="flex items-center gap-3 px-6 py-3 bg-rdpc-blue text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-blue-200 hover:scale-105 transition-transform">
            <span className="material-symbols-outlined text-lg">upload_file</span>
            Nouveau Document
          </button>
        </div>

        {/* Barre de filtres — la recherche par texte vit dans la navbar globale (?q=). */}
        <div className="glass p-4 rounded-[2rem] border-white flex flex-wrap items-center gap-4">
          {searchQuery && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-2xl border border-blue-100 bg-blue-50/50">
              <span className="material-symbols-outlined text-base text-rdpc-blue">search</span>
              <p className="text-xs text-slate-600 italic">
                <span className="font-bold not-italic text-slate-800">« {searchQuery} »</span>
              </p>
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-rdpc-blue"
              >
                Effacer
              </button>
            </div>
          )}

          <div className="flex items-center gap-3 overflow-x-auto pb-1 scrollbar-hide">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-5 py-4 bg-slate-50 border-none rounded-2xl text-xs font-black uppercase tracking-widest text-slate-500 focus:ring-8 focus:ring-blue-500/5 outline-none cursor-pointer">
              <option value="">Catégorie : Toutes</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-5 py-4 bg-slate-50 border-none rounded-2xl text-xs font-black uppercase tracking-widest text-slate-500 focus:ring-8 focus:ring-blue-500/5 outline-none cursor-pointer">
              <option value="">Statut : Tous</option>
              <option value="draft">Brouillon</option>
              <option value="in_review">En Révision</option>
              <option value="validated">Validé</option>
              <option value="archived">Archivé</option>
            </select>
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-rdpc-blue"></div>
        </div>
      )}

      {error && (
        <div className="text-center py-20 text-red-500 font-bold">{error}</div>
      )}

      {!isLoading && !error && docs.length === 0 && (
        <div className="text-center py-20 text-slate-400 font-bold">Aucun document trouvé.</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredDocs.map((doc) => (
          <div key={doc.id} onClick={() => setSelectedDoc(doc)} className="glass p-5 rounded-[2.5rem] hover:shadow-2xl hover:-translate-y-2 transition-all group cursor-pointer border border-white flex flex-col gap-5 overflow-hidden relative">
            {/* Effet de brillance au survol */}
            <div className="absolute top-0 -inset-full h-full w-1/2 z-5 block transform -skew-x-12 bg-gradient-to-r from-transparent to-white opacity-0 group-hover:animate-shine group-hover:opacity-10" />

            <div className="flex items-center justify-between">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner ${getTypeStyle(doc.mime_type || doc.file_type)}`}>
                <span className="material-symbols-outlined text-3xl font-bold">{getTypeIcon(doc.mime_type || doc.file_type)}</span>
              </div>
              <div className={`text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${getStatusStyle(doc.status)}`}>
                {getStatusLabel(doc.status)}
              </div>
            </div>

            <div className="flex-1 space-y-1">
              <h4 className="font-bold text-slate-800 line-clamp-1 group-hover:text-rdpc-blue transition-colors text-lg tracking-tight">{doc.title}</h4>
              <div className="flex items-center gap-2">
                {doc.category_name && <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[9px] font-black uppercase tracking-tighter">{doc.category_name}</span>}
                <span className="text-[10px] font-medium text-slate-400">V{doc.current_version_number} • {getFileTypeLabel(doc.mime_type || doc.file_type)}</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-5 border-t border-slate-50">
              <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                <span className="material-symbols-outlined text-sm">schedule</span>
                {formatDate(doc.updated_at)}
              </div>
              <span className="text-[10px] font-black text-slate-400">{formatFileSize(doc.file_size)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Audit Footnote */}
      {docs.length > 0 && (
        <div className="flex items-center justify-center gap-4 py-8 opacity-40">
          <div className="h-px w-20 bg-slate-300"></div>
          <span className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-400">Fin de la liste • Archivage Sécurisé AES-256</span>
          <div className="h-px w-20 bg-slate-300"></div>
        </div>
      )}

      {selectedDoc && (
        <DocumentDetailModal
          document={selectedDoc}
          onClose={() => setSelectedDoc(null)}
        />
      )}

      {isUploadModalOpen && (
        <UploadDocumentModal
          onClose={() => setIsUploadModalOpen(false)}
          onSuccess={() => {
            setIsUploadModalOpen(false);
            fetchInitialData();
          }}
        />
      )}
    </div>
  );
};

export default Documents;
