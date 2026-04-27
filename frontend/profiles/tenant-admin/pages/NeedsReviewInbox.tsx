import React, { useState, useEffect } from 'react';
import { api } from '../../../services/api';

interface NeedsReviewDocument {
  id: string;
  name: string;
  status: string;
  created_at: string;
  metadata?: any;
  arbitration_reason: string;
  suggested_rule?: any;
}

interface AuditLog {
  id: string;
  action: string;
  status: string;
  details: any;
  timestamp: string;
}

// Traduction des actions techniques en libellés métier
const ACTION_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  rule_execution:   { label: 'Analyse automatique', icon: 'psychology', color: 'bg-blue-100 text-blue-700' },
  upload:           { label: 'Dépôt du document',   icon: 'upload_file', color: 'bg-slate-100 text-slate-600' },
  classification:   { label: 'Tentative de classement', icon: 'folder_open', color: 'bg-amber-100 text-amber-700' },
  needs_review:     { label: 'Mis en attente de décision', icon: 'pending', color: 'bg-orange-100 text-orange-700' },
};

const NeedsReviewInbox: React.FC = () => {
  const [documents, setDocuments] = useState<NeedsReviewDocument[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<NeedsReviewDocument | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const [targetFolderId, setTargetFolderId] = useState('');
  const [resolverComment, setResolverComment] = useState('');
  const [newFilename, setNewFilename] = useState('');
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [suggestedRule, setSuggestedRule] = useState<any>(null);
  const [resolving, setResolving] = useState(false);
  const [toast, setToast] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
  const showToast = (t: NonNullable<typeof toast>) => { setToast(t); setTimeout(() => setToast(null), 4000); };

  useEffect(() => { fetchDocuments(); }, []);

  const fetchDocuments = async () => {
    setLoadingDocs(true);
    try {
      const docs = await api.getNeedsReviewDocuments();
      setDocuments(docs);
      if (docs.length > 0 && !selectedDoc) handleSelectDoc(docs[0]);
      else if (docs.length === 0) setSelectedDoc(null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDocs(false);
    }
  };

  const handleSelectDoc = async (doc: NeedsReviewDocument) => {
    setSelectedDoc(doc);
    setTargetFolderId('');
    setResolverComment('');
    setNewFilename('');
    setAuditLogs([]);
    setLoadingLogs(true);
    try {
      const logs = await api.getDocumentAuditLogs(doc.id);
      setAuditLogs(logs);
      setSuggestedRule(doc.suggested_rule || null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleResolve = async () => {
    if (!selectedDoc) return;
    setResolving(true);
    try {
      await api.resolveReview(selectedDoc.id, {
        target_folder_id: targetFolderId || undefined,
        resolver_comment: resolverComment,
        new_filename: newFilename || undefined,
        target_category_id: undefined,
      });
      showToast({ tone: 'success', message: 'Document traité et classé avec succès.' });
      fetchDocuments();
    } catch (err) {
      console.error(err);
      showToast({ tone: 'error', message: 'Erreur lors du traitement. Veuillez réessayer.' });
    } finally {
      setResolving(false);
    }
  };

  const handleCreateRuleFromSuggestion = async () => {
    if (!suggestedRule) return;
    try {
      await api.createRoutingRule(suggestedRule);
      showToast({ tone: 'success', message: 'Règle d\'aiguillage créée avec succès !' });
      setIsRuleModalOpen(false);
    } catch (err) {
      console.error(err);
      showToast({ tone: 'error', message: 'Erreur lors de la création de la règle.' });
    }
  };

  return (
    <div className="p-8 space-y-6 animate-in fade-in duration-700 h-full flex flex-col relative">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-[200] px-5 py-3 rounded-2xl shadow-2xl text-sm font-bold flex items-center gap-2 animate-in slide-in-from-top-4 ${toast.tone === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
          <span className="material-symbols-outlined text-base">{toast.tone === 'success' ? 'check_circle' : 'error'}</span>
          {toast.message}
        </div>
      )}

      {/* En-tête */}
      <div className="shrink-0 flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-[1.25rem] bg-amber-100 text-amber-600 flex items-center justify-center shadow-sm shrink-0">
            <span className="material-symbols-outlined text-2xl">inbox</span>
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tighter italic uppercase leading-none">
              Ma Bannette
            </h2>
            <p className="text-slate-500 text-sm font-medium mt-1">
              Documents en attente d'une décision de classement manuel.
            </p>
          </div>
        </div>
        {documents.length > 0 && (
          <div className="px-4 py-2 bg-amber-50 border border-amber-200 rounded-2xl text-amber-700 font-black text-sm flex items-center gap-2">
            <span className="material-symbols-outlined text-base">schedule</span>
            {documents.length} en attente
          </div>
        )}
      </div>

      {/* Layout 3 colonnes */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 overflow-hidden min-h-0">

        {/* Colonne 1 : Liste */}
        <div className="w-full lg:w-64 shrink-0 flex flex-col gap-2 overflow-y-auto pr-1 custom-scrollbar">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 px-1">
            Documents ({documents.length})
          </p>
          {loadingDocs ? (
            <div className="text-sm text-slate-400 italic px-2">Chargement...</div>
          ) : documents.length === 0 ? (
            <div className="p-5 rounded-[1.5rem] border-2 border-dashed border-slate-200 bg-white/40 text-center">
              <span className="material-symbols-outlined text-3xl text-slate-300 block mb-2">inbox</span>
              <p className="text-xs italic text-slate-500 leading-relaxed">
                Votre bannette est vide.<br />Aucun document ne nécessite votre intervention.
              </p>
            </div>
          ) : (
            documents.map(doc => (
              <div
                key={doc.id}
                onClick={() => handleSelectDoc(doc)}
                className={`p-4 rounded-[1.5rem] border-2 transition-all cursor-pointer group ${
                  selectedDoc?.id === doc.id
                    ? 'bg-white border-rdpc-blue shadow-xl ring-2 ring-rdpc-blue/10'
                    : 'bg-white/60 border-transparent hover:bg-white hover:shadow-md'
                }`}
              >
                <div className="flex items-start gap-2 mb-1.5">
                  <span className="material-symbols-outlined text-amber-500 text-lg shrink-0 mt-0.5">warning</span>
                  <p className="text-sm font-bold text-slate-800 leading-tight">{doc.name}</p>
                </div>
                <p className="text-[10px] text-slate-500 font-medium leading-snug line-clamp-2 ml-6">
                  {doc.arbitration_reason}
                </p>
              </div>
            ))
          )}
        </div>

        {/* Colonne 2 : Historique */}
        <div className="flex-1 bg-white rounded-[2rem] border-2 border-slate-200 p-6 flex flex-col overflow-y-auto custom-scrollbar shadow-sm min-h-0">
          {selectedDoc ? (
            <>
              <h3 className="font-black text-lg text-slate-800 mb-1 tracking-tighter uppercase italic">
                {selectedDoc.name}
              </h3>
              <div className="flex items-center gap-2 mb-5">
                <span className="material-symbols-outlined text-amber-500 text-sm">warning</span>
                <p className="text-xs text-amber-700 font-bold">{selectedDoc.arbitration_reason}</p>
              </div>

              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">
                Historique du document
              </p>

              {loadingLogs ? (
                <p className="text-sm text-slate-400 italic">Chargement...</p>
              ) : auditLogs.length === 0 ? (
                <p className="text-sm text-slate-400 italic">Aucun historique disponible.</p>
              ) : (
                <div className="space-y-3">
                  {auditLogs.map((log) => {
                    const meta = ACTION_LABELS[log.action] || { label: log.action, icon: 'history', color: 'bg-slate-100 text-slate-500' };
                    return (
                      <div key={log.id} className="flex items-start gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${meta.color}`}>
                          <span className="material-symbols-outlined text-[18px]">{meta.icon}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-bold text-slate-800 text-sm">{meta.label}</p>
                            <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full shrink-0 ${
                              log.status === 'success' ? 'bg-green-100 text-green-700' :
                              log.status === 'failed' ? 'bg-red-100 text-red-700' :
                              'bg-slate-100 text-slate-500'
                            }`}>
                              {log.status === 'success' ? 'Réussi' : log.status === 'failed' ? 'Échoué' : log.status}
                            </span>
                          </div>
                          {log.details?.reason && (
                            <p className="text-xs text-slate-500 mt-1">{log.details.reason}</p>
                          )}
                          {log.timestamp && (
                            <p className="text-[10px] text-slate-400 mt-0.5">{new Date(log.timestamp).toLocaleString('fr-FR')}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-300 gap-3">
              <span className="material-symbols-outlined text-5xl">manage_search</span>
              <p className="italic font-bold tracking-widest uppercase text-xs">Sélectionnez un document</p>
            </div>
          )}
        </div>

        {/* Colonne 3 : Résolution */}
        <div className="w-full lg:w-72 shrink-0 flex flex-col gap-4">
          {selectedDoc ? (
            <div className="bg-white rounded-[2rem] border-2 border-slate-200 shadow-sm flex flex-col overflow-hidden">
              <div className="h-1.5 bg-gradient-to-r from-rdpc-blue to-blue-400 shrink-0" />
              <div className="p-6 flex flex-col gap-4 overflow-y-auto custom-scrollbar flex-1">
                <h3 className="font-black text-slate-800 flex items-center gap-2 uppercase italic tracking-tighter">
                  <span className="material-symbols-outlined text-rdpc-blue">task_alt</span>
                  Décision de classement
                </h3>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Service de destination</label>
                  <input
                    type="text"
                    value={targetFolderId}
                    onChange={(e) => setTargetFolderId(e.target.value)}
                    placeholder="ID du dossier cible"
                    className="w-full bg-slate-50 border-2 border-slate-100 focus:border-rdpc-blue outline-none rounded-xl py-2.5 px-3 text-sm font-bold text-slate-700"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Laissez vide pour ne pas rediriger.</p>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Renommer (Optionnel)</label>
                  <input
                    type="text"
                    value={newFilename}
                    onChange={(e) => setNewFilename(e.target.value)}
                    placeholder={selectedDoc.name}
                    className="w-full bg-slate-50 border-2 border-slate-100 focus:border-rdpc-blue outline-none rounded-xl py-2.5 px-3 text-sm font-bold text-slate-700"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Commentaire</label>
                  <textarea
                    value={resolverComment}
                    onChange={(e) => setResolverComment(e.target.value)}
                    placeholder="Pourquoi avez-vous fait ce choix ?"
                    rows={3}
                    className="w-full bg-slate-50 border-2 border-slate-100 focus:border-rdpc-blue outline-none rounded-xl py-2.5 px-3 text-sm text-slate-700 resize-none"
                  />
                </div>

                <button
                  onClick={handleResolve}
                  disabled={resolving}
                  className="w-full py-3 bg-rdpc-blue text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-200 hover:bg-blue-800 transition-all disabled:opacity-50"
                >
                  {resolving ? 'Traitement...' : 'Valider & Classer'}
                </button>

                {suggestedRule && (
                  <div className="pt-4 border-t border-slate-100">
                    <p className="text-[10px] text-slate-500 font-bold mb-2">
                      Une règle d'aiguillage peut être créée pour automatiser ce type de classement à l'avenir :
                    </p>
                    <button
                      onClick={() => setIsRuleModalOpen(true)}
                      className="w-full py-2.5 bg-purple-50 border border-purple-200 text-purple-700 rounded-xl text-xs font-bold hover:bg-purple-100 transition-all flex items-center justify-center gap-2"
                    >
                      <span className="material-symbols-outlined text-sm">auto_awesome</span>
                      Créer une règle automatique
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-[2rem] border-2 border-dashed border-slate-200 flex-1 flex flex-col items-center justify-center text-slate-300 p-6 text-center gap-2">
              <span className="material-symbols-outlined text-4xl">task_alt</span>
              <p className="text-xs italic font-bold tracking-widest uppercase">Sélectionnez un document pour décider</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal Règle suggérée */}
      {isRuleModalOpen && suggestedRule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[2.5rem] p-8 w-[540px] max-h-[90vh] overflow-y-auto shadow-2xl relative">
            <button
              onClick={() => setIsRuleModalOpen(false)}
              className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center bg-slate-100 rounded-full text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center">
                <span className="material-symbols-outlined">auto_awesome</span>
              </div>
              <div>
                <h2 className="font-black text-slate-800 uppercase italic tracking-tighter">Nouvelle règle d'aiguillage</h2>
                <p className="text-xs text-slate-500">Générée depuis ce document</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-4 leading-relaxed">
              Le système propose de créer une règle pour classer automatiquement les prochains documents similaires, sans intervention manuelle.
            </p>
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-xs text-slate-700 mb-6 space-y-2">
              {suggestedRule.name && <p><span className="font-black text-slate-400 uppercase tracking-widest">Nom :</span> {suggestedRule.name}</p>}
              {suggestedRule.description && <p><span className="font-black text-slate-400 uppercase tracking-widest">Description :</span> {suggestedRule.description}</p>}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setIsRuleModalOpen(false)} className="flex-1 py-3 text-slate-600 bg-slate-100 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-slate-200">Annuler</button>
              <button onClick={handleCreateRuleFromSuggestion} className="flex-1 py-3 text-white bg-purple-600 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-purple-700 shadow-lg shadow-purple-200">Confirmer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NeedsReviewInbox;
