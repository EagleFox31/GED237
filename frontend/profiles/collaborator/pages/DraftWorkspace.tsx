import React, { useState, useEffect } from 'react';
import { api } from '../../../services/api';
import type { Document, WorkflowValidator } from '../../../types';
import DocumentDetailModal from '../../../components/DocumentDetailModal';
import UploadDocumentModal from '../../../components/UploadDocumentModal';
import { pushClientOperationError } from '../../../lib/errors/clientOperationError';
import { loadRejectionReasons, needsCorrection } from '../../../lib/rejectionReasons';

const STATUS_LABELS: Record<string, string> = {
  in_review: 'En Validation',
  rejected: 'Rejeté',
  returned: 'À corriger',
  validated: 'Validé',
  signed: 'Signé',
};

const DraftWorkspace: React.FC = () => {
  const [documents, setDocuments] = useState<any[]>([]);
  const [validators, setValidators] = useState<WorkflowValidator[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);

  // State for the submission modal
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [documentToSubmit, setDocumentToSubmit] = useState<string | null>(null);
  const [selectedValidator, setSelectedValidator] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  // Reason of the last rejection or return, per document id (read from each sent-back document).
  const [reasons, setReasons] = useState<Record<string, string>>({});
  // Corrected file, sent as a new version before resubmitting a sent-back document.
  const [correctedFile, setCorrectedFile] = useState<File | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Valideurs proposables (managers et administrateurs du tenant) ; liste vide si l'appel échoue.
      const [docsResp, validatorsResp] = await Promise.all([
        api.getDocuments(),
        api.getWorkflowValidators().catch(() => [] as WorkflowValidator[])
      ]);
      setDocuments(docsResp);
      setValidators(validatorsResp);
      // Cards show at once; reasons fill in when read.
      void loadRejectionReasons(docsResp, api.getDocument).then(setReasons);
    } catch (error) {
      console.error("Failed to fetch data", error);
    } finally {
      setLoading(false);
    }
  };

  const openSubmitModal = (id: string) => {
    setDocumentToSubmit(id);
    setCorrectedFile(null);
    setShowSubmitModal(true);
  };

  const closeSubmitModal = () => {
    setShowSubmitModal(false);
    setDocumentToSubmit(null);
    setCorrectedFile(null);
  };

  const docToSubmit = documents.find((d) => d.id === documentToSubmit);
  const resubmitting = needsCorrection(docToSubmit?.status);

  const submitWorkflow = async () => {
    if (!documentToSubmit || !selectedValidator) {
      pushClientOperationError(null, { fallbackDetail: "Veuillez sélectionner un valideur.", severity: "warning" });
      return;
    }

    setSubmitting(true);
    try {
      if (resubmitting && correctedFile) {
        await api.uploadDocumentVersion(documentToSubmit, correctedFile, 'Version corrigée avant nouvelle soumission');
        // Uploaded: a retry after a failed submission must not send the same file again (409).
        setCorrectedFile(null);
      }
      // Create a 1-step workflow
      const steps = [
        {
          document_id: documentToSubmit,
          step_order: 1,
          label: "Validation Manager",
          assigned_to: selectedValidator
        }
      ];

      await api.createWorkflowSteps(documentToSubmit, steps);
      closeSubmitModal();
      setSelectedValidator('');
      fetchData();
    } catch (e) {
      // L'erreur HTTP est déjà publiée par le client (bus global) : pas de second message.
      console.error(e);
    } finally {
      setSubmitting(false);
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

              {needsCorrection(doc.status) && (
                <div className="mb-4 space-y-3">
                  {reasons[doc.id] && (
                    <p className="text-xs text-red-800 bg-red-50 border border-red-100 rounded-xl px-3 py-2 line-clamp-3" title={reasons[doc.id]} data-testid="rejection-reason">
                      <span className="font-bold">Motif : </span>{reasons[doc.id]}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openSubmitModal(doc.id);
                    }}
                    disabled={submitting}
                    className="w-full px-3 py-2 bg-rdpc-blue text-white rounded-lg text-[10px] font-bold uppercase tracking-wide hover:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Corriger et resoumettre
                  </button>
                </div>
              )}

              <div className="flex justify-between items-center mt-auto border-t border-slate-50 pt-4">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                  {new Date(doc.created_at).toLocaleDateString()}
                </span>

                {doc.status === 'draft' ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openSubmitModal(doc.id);
                    }}
                    disabled={submitting}
                    className="px-3 py-1 bg-rdpc-blue text-white rounded-lg text-[9px] font-bold uppercase tracking-wide hover:bg-blue-800 transition-colors shadow-lg shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? 'Soumission...' : 'Soumettre'}
                  </button>
                ) : (
                  <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md ${doc.status === 'rejected' ? 'bg-red-50 text-red-700' :
                    doc.status === 'returned' ? 'bg-orange-50 text-orange-800' :
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

      {/* Modal Workflow Submit */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[2.5rem] p-10 w-full max-w-lg shadow-2xl relative">
            <button
              onClick={closeSubmitModal}
              aria-label="Fermer"
              className="absolute top-6 right-6 w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
            >
              <span className="material-symbols-outlined">close</span>
            </button>

            <h3 className="text-2xl font-black text-slate-800 mb-2">{resubmitting ? 'Corriger et resoumettre' : 'Circuit de Validation'}</h3>
            <p className="text-sm text-slate-500 font-medium mb-8">Choisissez la personne qui doit valider ce document.</p>

            <div className="space-y-6">
              {resubmitting && documentToSubmit && reasons[documentToSubmit] && (
                <p className="text-sm text-red-800 bg-red-50 border border-red-100 rounded-2xl px-4 py-3">
                  <span className="font-bold">Motif : </span>{reasons[documentToSubmit]}
                </p>
              )}
              {resubmitting && (
                <div className="space-y-2">
                  <label htmlFor="corrected-file" className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Fichier corrigé (facultatif)</label>
                  <input
                    id="corrected-file"
                    type="file"
                    onChange={(e) => setCorrectedFile(e.target.files?.[0] ?? null)}
                    className="w-full text-sm text-slate-600 file:mr-3 file:px-3 file:py-2 file:rounded-xl file:border-0 file:bg-slate-100 file:font-bold file:text-slate-700"
                  />
                  <p className="ml-1 text-xs text-slate-500">Sans fichier, le document part tel quel.</p>
                </div>
              )}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Valideur (Manager/Directeur)</label>
                <select
                  value={selectedValidator}
                  onChange={(e) => setSelectedValidator(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-3 px-4 font-bold text-slate-700 outline-none focus:border-cam-yellow/50 appearance-none"
                >
                  <option value="" disabled>-- Sélectionner un manager --</option>
                  {validators.map(validator => (
                    <option key={validator.id} value={validator.id}>
                      {validator.full_name}
                    </option>
                  ))}
                </select>
                {!loading && validators.length === 0 && (
                  <p className="ml-1 text-xs text-slate-400">Aucun valideur disponible. Contactez votre administrateur.</p>
                )}
              </div>

              <button
                onClick={submitWorkflow}
                disabled={submitting || !selectedValidator}
                className="w-full py-4 bg-cam-yellow text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-yellow-200 hover:bg-yellow-600 hover:scale-[1.02] transition-all disabled:opacity-70 disabled:hover:scale-100"
              >
                {submitting ? 'Envoi en cours...' : resubmitting ? 'Resoumettre au visa' : 'Soumettre au visa'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default DraftWorkspace;
