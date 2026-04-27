
import React, { useEffect, useState } from 'react';
import { api } from '../../../services/api';
import { Document, getFileTypeLabel, formatDate, getStatusLabel } from '../../../types';

const LibraryView: React.FC = () => {
  const [docs, setDocs] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDocs = async () => {
      try {
        const data = await api.getDocuments({ status: 'validated' });
        setDocs(data);
      } catch (err) {
        console.error('Failed to fetch library documents:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchDocs();
  }, []);

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
        <div className="flex items-center justify-between mb-8 pb-8 border-b border-slate-100">
          <div className="flex items-center gap-6">
             <div className="text-center">
               <p className="text-2xl font-black italic">{isLoading ? '...' : docs.length}</p>
               <p className="text-[8px] font-black uppercase text-slate-400">Documents dispos</p>
             </div>
             <div className="h-10 w-px bg-slate-100"></div>
             <div className="text-center">
               <p className="text-2xl font-black italic">{isLoading ? '...' : docs.filter(d => d.status === 'validated').length}</p>
               <p className="text-[8px] font-black uppercase text-slate-400">Validés</p>
             </div>
          </div>
          <div className="flex gap-2">
            <button className="p-3 bg-slate-50 rounded-xl text-slate-400 hover:bg-rdpc-blue hover:text-white transition-all">
              <span className="material-symbols-outlined">grid_view</span>
            </button>
            <button className="p-3 bg-slate-50 rounded-xl text-slate-400">
              <span className="material-symbols-outlined">list</span>
            </button>
          </div>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rdpc-blue"></div>
          </div>
        )}

        {!isLoading && docs.length === 0 && (
          <div className="text-center py-10 text-slate-400 font-bold">Aucun document disponible.</div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {docs.map((doc) => (
            <div key={doc.id} className="flex items-center gap-4 p-4 rounded-2xl bg-white border border-slate-50 hover:border-slate-200 transition-all cursor-pointer">
              <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-slate-300 italic font-black text-xs">
                {getFileTypeLabel(doc.file_type)}
              </div>
              <div className="flex-1">
                <p className="text-xs font-black text-slate-800 uppercase italic">{doc.title}</p>
                <p className="text-[10px] font-bold text-slate-400">{formatDate(doc.created_at)} • {getStatusLabel(doc.status)}</p>
              </div>
              <span className="material-symbols-outlined text-slate-300">visibility</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LibraryView;
