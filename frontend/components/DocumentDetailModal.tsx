// frontend/components/DocumentDetailModal.tsx
import React, { useState, useEffect } from 'react';
import { Icons } from '../constants';
import { Document, WorkflowStep, getStatusLabel, getFileTypeLabel, formatDate, formatFileSize } from '../types';
import { api } from '../services/api';

interface DocumentDetailModalProps {
  document: Document;
  onClose: () => void;
}

const DocumentDetailModal: React.FC<DocumentDetailModalProps> = ({ document, onClose }) => {
  const [activeTab, setActiveTab] = useState<'info' | 'workflow' | 'history'>('info');
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [stepsLoading, setStepsLoading] = useState(false);
  const [workflowActions, setWorkflowActions] = useState<any[]>([]);
  const [versions, setVersions] = useState<any[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [processingMode, setProcessingMode] = useState<'archive' | 'process'>(document.processing_mode || 'process');
  const [startingWorkflow, setStartingWorkflow] = useState(false);

  useEffect(() => {
    if (activeTab === 'workflow') {
      loadWorkflowSteps();
    } else if (activeTab === 'history') {
      loadVersions();
    }
  }, [activeTab]);

  const loadWorkflowSteps = async () => {
    setStepsLoading(true);
    try {
      const [stepsData, actionsData] = await Promise.all([
        api.getWorkflowSteps(document.id),
        api.getWorkflowActions(document.id).catch(() => []),
      ]);
      setSteps(stepsData);
      setWorkflowActions(actionsData);
    } catch (err) {
      console.error('Failed to fetch workflow steps:', err);
    } finally {
      setStepsLoading(false);
    }
  };

  const loadVersions = async () => {
    setVersionsLoading(true);
    try {
      const data = await api.getDocumentVersions(document.id);
      setVersions(data);
    } catch (err) {
      console.error('Failed to fetch versions:', err);
    } finally {
      setVersionsLoading(false);
    }
  };

  const handleValidate = async (stepId: string, actionType: string, outcomeType: 'accepted' | 'acknowledged' | 'rejected' | 'returned') => {
    let finalOutcome = outcomeType;
    if (outcomeType === 'accepted' && actionType === 'read_ack') finalOutcome = 'acknowledged';
    const comment = (outcomeType === 'rejected' || outcomeType === 'returned') ? prompt('Saisir un commentaire explicatif :') : null;

    // User cancelled the prompt?
    if ((outcomeType === 'rejected' || outcomeType === 'returned') && comment === null) return;
    if (!document.current_version_id) {
      setActionError("Impossible d'exécuter l'action: version courante introuvable pour ce document.");
      return;
    }

    try {
      setActionError(null);
      await api.submitWorkflowAction(stepId, {
        action_type: actionType,
        outcome: finalOutcome,
        document_version_id: document.current_version_id,
        comment: comment || undefined
      });
      await loadWorkflowSteps();
    } catch (err) {
      console.error('Validation failed:', err);
      setActionError("L'action de workflow a échoué. Veuillez réessayer.");
    }
  };

  const handleStartWorkflow = async () => {
    setActionError(null);
    setStartingWorkflow(true);
    try {
      const updated = await api.startDocumentWorkflow(document.id);
      setProcessingMode(updated.processing_mode || 'process');
      await loadWorkflowSteps();
    } catch (err) {
      console.error('Start workflow failed:', err);
      setActionError("Impossible de lancer le circuit. Veuillez vérifier qu'il existe une règle ou un circuit applicable.");
    } finally {
      setStartingWorkflow(false);
    }
  };

  const getActionLabel = (type: string) => {
    switch (type) {
      case 'visa': return 'Viser';
      case 'approval': return 'Approuver';
      case 'final_signature': return 'Signer';
      case 'read_ack': return 'J\'ai lu';
      default: return 'Valider';
    }
  };

  const getOutcomeBadge = (outcome: string) => {
    switch (outcome) {
      case 'accepted': return { label: 'Accepté', cls: 'bg-green-100 text-green-700' };
      case 'acknowledged': return { label: 'Lu', cls: 'bg-blue-100 text-blue-700' };
      case 'rejected': return { label: 'Rejeté', cls: 'bg-red-100 text-red-700' };
      case 'returned': return { label: 'Renvoyé', cls: 'bg-orange-100 text-orange-700' };
      default: return { label: outcome, cls: 'bg-slate-100 text-slate-600' };
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-8 animate-in fade-in zoom-in duration-300">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md" onClick={onClose}></div>

      <div className="relative glass w-full max-w-5xl h-[85vh] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col border border-white/50">
        {/* Header */}
        <div className="p-8 border-b border-slate-200/50 flex items-center justify-between bg-white/50">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 shadow-sm">
              <Icons.Documents className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800 tracking-tight">{document.title}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{getFileTypeLabel(document.file_type)}</span>
                <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  document.status === 'validated' || document.status === 'signed' ? 'bg-green-100 text-green-600' :
                  document.status === 'in_review' ? 'bg-blue-100 text-blue-600' :
                  document.status === 'rejected' ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-600'
                }`}>{getStatusLabel(document.status)}</span>
                {document.processing_mode === 'archive' && (
                  <>
                    <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 flex items-center gap-1" title="Cette pièce a été déposée en mode archivage. Aucune règle d'aiguillage n'a été appliquée.">
                      <span className="material-symbols-outlined" style={{fontSize: '12px'}}>folder</span>
                      Archivé sans circuit
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-slate-100 rounded-2xl transition-all">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 text-slate-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="px-8 pt-4 flex gap-8 border-b border-slate-200/50 bg-white/30">
          {[
            { id: 'info', label: 'Détails & Aperçu', icon: Icons.Dashboard },
            { id: 'workflow', label: 'Circuit de Validation', icon: Icons.CheckCircle },
            { id: 'history', label: 'Historique des Versions', icon: Icons.History },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`pb-4 text-sm font-bold transition-all relative flex items-center gap-2 ${
                activeTab === tab.id ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {activeTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-600 rounded-t-full"></div>}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 bg-slate-50/30">
          {activeTab === 'info' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
              <div className="space-y-6">
                <div className="glass p-6 rounded-3xl border-white space-y-4">
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest">Métadonnées Officielles</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-slate-400 font-medium">Propriétaire</p>
                      <p className="font-bold text-slate-700">{document.owner_name || document.owner_id}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 font-medium">Date de création</p>
                      <p className="font-bold text-slate-700">{formatDate(document.created_at)}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 font-medium">Type de document</p>
                      <p className="font-bold text-slate-700">{getFileTypeLabel(document.file_type)}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 font-medium">Taille</p>
                      <p className="font-bold text-slate-700">{formatFileSize(document.file_size)}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 font-medium">Catégorie</p>
                      <p className="font-bold text-slate-700">{document.category_name || '—'}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 font-medium">Version</p>
                      <p className="font-bold text-slate-700">V{document.current_version_number || '—'}</p>
                    </div>
                  </div>
                  {document.tags && document.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {document.tags.map((tag, i) => (
                        <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-bold">#{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="p-6 bg-blue-600 rounded-3xl text-white shadow-xl shadow-blue-100 relative overflow-hidden">
                  <h3 className="text-lg font-bold mb-2">Actions rapides</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <button className="py-3 bg-white/20 hover:bg-white/30 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2">
                      <Icons.Documents className="w-4 h-4" /> Télécharger
                    </button>
                    <button className="py-3 bg-white/20 hover:bg-white/30 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2">
                      <Icons.Search className="w-4 h-4" /> Partager
                    </button>
                  </div>
                  <Icons.Flame className="absolute -right-6 -bottom-6 w-32 h-32 opacity-10 rotate-12" />
                </div>
              </div>
              <div className="glass rounded-3xl border-white bg-slate-200/50 flex flex-col items-center justify-center text-slate-400 min-h-[300px]">
                <Icons.Documents className="w-16 h-16 opacity-20 mb-4" />
                <p className="text-sm font-bold">Aperçu non disponible en mode sécurisé</p>
                <button className="mt-4 px-6 py-3 bg-white text-slate-600 rounded-2xl text-xs font-bold shadow-sm hover:shadow-md transition-all">Générer un aperçu temporaire</button>
              </div>
            </div>
          )}

          {activeTab === 'workflow' && (
            <div className="max-w-2xl mx-auto py-4">
              {actionError && (
                <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {actionError}
                </div>
              )}
              {stepsLoading && (
                <div className="flex items-center justify-center py-10">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rdpc-blue"></div>
                </div>
              )}
              {processingMode === 'archive' && (
                <div className="mb-6 rounded-3xl border border-amber-200 bg-amber-50/70 p-5">
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-amber-600 mt-0.5">archive</span>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-amber-800">Cette pièce a été archivée sans circuit.</p>
                      <p className="text-xs text-amber-700 mt-1">Vous pouvez à tout moment lancer un circuit de validation a posteriori (les règles d'aiguillage seront appliquées si elles existent).</p>
                      <button
                        onClick={handleStartWorkflow}
                        disabled={startingWorkflow}
                        className="mt-3 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2"
                      >
                        <span className="material-symbols-outlined text-base">play_arrow</span>
                        {startingWorkflow ? 'Lancement…' : 'Lancer un circuit maintenant'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {!stepsLoading && steps.length === 0 && processingMode !== 'archive' && (
                <div className="text-center py-10 text-slate-400 font-bold">Aucune étape de workflow définie.</div>
              )}
              {!stepsLoading && steps.length > 0 && (
                <div className="relative space-y-12 before:absolute before:inset-0 before:left-7 before:h-full before:w-0.5 before:bg-slate-200">
                  {steps.map((step) => (
                    <div key={step.id} className="relative flex items-start gap-8">
                      <div className={`relative z-10 w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ${
                        step.status === 'completed' ? 'bg-green-500 text-white' :
                        step.status === 'current' ? 'bg-blue-600 text-white animate-pulse' :
                        step.status === 'rejected' ? 'bg-red-500 text-white' :
                        'bg-white text-slate-300 border border-slate-200'
                      }`}>
                        {step.status === 'completed' ? <Icons.CheckCircle className="w-8 h-8" /> :
                         step.status === 'current' ? <Icons.Clock className="w-8 h-8" /> :
                         step.status === 'rejected' ? <span className="material-symbols-outlined text-3xl">close</span> :
                         <Icons.Flame className="w-8 h-8" />}
                      </div>
                      <div className={`flex-1 p-6 rounded-3xl border transition-all ${
                        step.status === 'current' ? 'bg-white shadow-xl border-blue-100 scale-105' : 'bg-white/50 border-slate-100 opacity-80'
                      }`}>
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-bold text-slate-800">{step.label}</h4>
                            <p className="text-xs text-slate-400 mt-1">Étape {step.step_order}</p>
                          </div>
                          {step.completed_at && <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{formatDate(step.completed_at)}</span>}
                        </div>
                        {step.comment && (
                          <div className="mt-4 p-3 bg-slate-50 rounded-xl border-l-4 border-blue-400">
                            <p className="text-xs italic text-slate-600">"{step.comment}"</p>
                          </div>
                        )}
                        {/* Historique des actions sur ce step */}
                        {workflowActions.filter(a => a.workflow_step_id === step.id).map((action: any) => {
                          const badge = getOutcomeBadge(action.outcome);
                          return (
                            <div key={action.id} className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-start gap-3">
                              <span className="material-symbols-outlined text-slate-400 text-base mt-0.5">edit_note</span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-bold text-slate-700">{action.actor_name || 'Inconnu'}</span>
                                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${badge.cls}`}>{badge.label}</span>
                                  <span className="text-[9px] text-slate-400 uppercase tracking-wider">{getActionLabel(action.action_type)}</span>
                                </div>
                                {action.comment && <p className="text-xs italic text-slate-500 mt-1">"{action.comment}"</p>}
                                <p className="text-[10px] text-slate-300 mt-1">{new Date(action.performed_at).toLocaleString('fr-FR')}</p>
                              </div>
                            </div>
                          );
                        })}
                        {step.status === 'current' && (
                          <div className="flex gap-2 mt-6">
                            <button onClick={() => handleValidate(step.id, step.expected_action_type || 'visa', 'accepted')} className="px-4 py-2 bg-green-500 text-white rounded-xl text-xs font-bold hover:bg-green-600 transition-all">{getActionLabel(step.expected_action_type)}</button>
                            <button onClick={() => handleValidate(step.id, step.expected_action_type || 'visa', 'returned')} className="px-4 py-2 bg-orange-500 text-white rounded-xl text-xs font-bold hover:bg-orange-600 transition-all">Renvoyer pour correction</button>
                            <button onClick={() => handleValidate(step.id, step.expected_action_type || 'visa', 'rejected')} className="px-4 py-2 bg-red-500 text-white rounded-xl text-xs font-bold hover:bg-red-600 transition-all">Rejeter</button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="max-w-3xl mx-auto space-y-4">
              {versionsLoading && (
                <div className="flex items-center justify-center py-10">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rdpc-blue"></div>
                </div>
              )}
              {!versionsLoading && versions.length === 0 && (
                <div className="text-center py-10 text-slate-400 font-bold">Aucun historique disponible.</div>
              )}
              {!versionsLoading && versions.map((v) => (
                <div key={v.id} className={`glass p-5 rounded-3xl border flex items-center justify-between transition-all ${
                  v.is_current ? 'border-blue-400 bg-blue-50/50' : 'border-slate-100 hover:border-slate-200'
                }`}>
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black ${
                      v.is_current ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-slate-100 text-slate-400'
                    }`}>
                      V{v.version_number}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-slate-800">Version {v.version_number}</h4>
                        {v.is_current && <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-blue-100 text-blue-600 rounded-full">Actuelle</span>}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">Mis en ligne le {formatDate(v.uploaded_at)} par <span className="text-slate-600 font-semibold">{v.uploaded_by_name || 'Système'}</span></p>
                      {v.change_note && <p className="text-xs italic text-slate-500 mt-2 p-2 bg-white/50 rounded-lg">"{v.change_note}"</p>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">{formatFileSize(v.file_size)}</span>
                    <button className="text-[10px] font-black text-rdpc-blue uppercase tracking-widest hover:underline">Télécharger</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-6 bg-slate-100/50 border-t border-slate-200/50 flex justify-end gap-3">
          <button onClick={onClose} className="px-6 py-3 text-sm font-bold text-slate-500 hover:text-slate-800 transition-all">Fermer</button>
        </div>
      </div>
    </div>
  );
};

export default DocumentDetailModal;
