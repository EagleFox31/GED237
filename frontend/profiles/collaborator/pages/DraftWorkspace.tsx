import React, { useState, useEffect } from 'react';
import { api } from '../../../services/api';
import type { Document } from '../../../types';
import DocumentDetailModal from '../../../components/DocumentDetailModal';
import UploadDocumentModal from '../../../components/UploadDocumentModal';
import { SubmitForValidationDialog } from '../../../components/workflow/SubmitForValidationDialog';

const STATUS_LABELS: Record<string, string> = {
  in_review: 'En Validation',
  rejected: 'Rejeté',
  validated: 'Validé',
  signed: 'Signé',
};

const DraftWorkspace: React.FC = () => {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  // Brouillon dont la fenêtre de soumission est ouverte (null : fermée).
  const [documentToSubmit, setDocumentToSubmit] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setDocuments(await api.getDocuments());
    } catch (error) {
      console.error("Failed to fetch data", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-700 h-full flex flex-col">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-cam-green/10 text-cam-green rounded-full text-[9px] font-black uppercase tracking-[0.2em] mb-3 border border-cam-green/20">
            Espace de Création
          </div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter italic uppercase">Mon <span className="text-cam-green">Atelier</span></h2>
          <p className="text-slate-500 mt-1 font-medium italic">Rédigez vos notes et soumettez-les au circuit de visa.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-6 py-4 bg-cam-green text-white rounded-2xl shadow-xl shadow-green-100 hover:bg-green-700 hover:scale-105 transition-all flex items-center gap-3 font-bold uppercase text-xs tracking-widest"
        >
          <span className="material-symbols-outlined text-2xl">add_circle</span>
          Nouveau Document
        </button>
      </div>

      {/* Grid des documents */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 overflow-y-auto p-1">
        {loading ? (
          <p className="text-slate-400 font-bold italic">Chargement de vos brouillons...</p>
        ) : documents.length === 0 ? (
          <div className="col-span-full py-20 text-center border-2 border-dashed border-slate-200 rounded-[3rem]">
            <span className="material-symbols-outlined text-6xl text-slate-200 mb-4">draft</span>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Aucun document en cours</p>
          </div>
        ) : (
          documents.map((doc) => (
            <div key={doc.id} onClick={() => setSelectedDoc(doc as Document)} className="glass p-6 rounded-[2rem] bg-white border-white hover:shadow-2xl transition-all cursor-pointer group relative overflow-hidden" data-testid="draft-card">
              <span className="material-symbols-outlined text-slate-200 group-hover:text-cam-green mb-4 transition-colors text-4xl">description</span>
              <h4 className="font-black text-slate-800 leading-tight mb-2 group-hover:text-cam-green transition-colors line-clamp-2 min-h-[3rem]"><button type="button" onClick={(e) => { e.stopPropagation(); setSelectedDoc(doc as Document); }} className="text-left" aria-label={`Ouvrir ${doc.title}`}>{doc.title}</button></h4>

              <div className="flex flex-wrap gap-2 mb-4">
                {doc.tags?.map((tag: string, i: number) => (
                  <span key={i} className="text-[8px] bg-slate-100 text-slate-500 px-2 py-1 rounded-md font-bold uppercase">{tag}</span>
                ))}
              </div>

              <div className="flex justify-between items-center mt-auto border-t border-slate-50 pt-4">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                  {new Date(doc.created_at).toLocaleDateString()}
                </span>

                {doc.status === 'draft' ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDocumentToSubmit(doc.id);
                    }}
                    className="px-3 py-1 bg-rdpc-blue text-white rounded-lg text-[9px] font-bold uppercase tracking-wide hover:bg-blue-800 transition-colors shadow-lg shadow-blue-200"
                  >
                    Soumettre
                  </button>
                ) : (
                  <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md ${doc.status === 'rejected' ? 'bg-red-50 text-red-700' :
                    doc.status === 'validated' || doc.status === 'signed' ? 'bg-green-50 text-green-600' :
                      'bg-yellow-50 text-yellow-600'
                    }`}>
                    {STATUS_LABELS[doc.status] ?? doc.status}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <UploadDocumentModal
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false);
            fetchData();
          }}
        />
      )}

      {selectedDoc && <DocumentDetailModal document={selectedDoc} onClose={() => setSelectedDoc(null)} />}

      {documentToSubmit && (
        <SubmitForValidationDialog
          documentId={documentToSubmit}
          onClose={() => setDocumentToSubmit(null)}
          onSubmitted={() => {
            setDocumentToSubmit(null);
            fetchData();
          }}
        />
      )}

    </div>
  );
};

export default DraftWorkspace;
