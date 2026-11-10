
import React, { useState, useEffect } from 'react';
import { api } from '../../../services/api';
import type { WorkflowDecision } from '../../../services/resources/workflows.api';
import type { PendingWorkflowTask } from '../../../types';
import { RejectReasonDialog } from '../../../components/workflow/RejectReasonDialog';
import { ApiError } from '../../../lib/errors';
import { pushClientOperationError } from '../../../lib/errors/clientOperationError';

const ValidationHub: React.FC = () => {
  const [documents, setDocuments] = useState<PendingWorkflowTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<PendingWorkflowTask | null>(null);

  useEffect(() => {
    fetchWorkflows();
  }, []);

  const fetchWorkflows = async () => {
    try {
      const pendingWorkflows = await api.getPendingWorkflows();
      setDocuments(pendingWorkflows);
    } catch (error) {
      console.error("Failed to fetch pending workflows", error);
    } finally {
      setLoading(false);
    }
  };

  const decide = async (task: PendingWorkflowTask, decision: WorkflowDecision, comment?: string) => {
    setProcessingId(task.id);
    try {
      await api.decideWorkflowStep(task, decision, comment);
      setDocuments(prev => prev.filter(d => d.id !== task.id));
      setRejecting(null);
    } catch (e) {
      // Les erreurs HTTP sont déjà affichées par le bus global ; reste le cas local (version absente).
      if (!(e instanceof ApiError)) {
        pushClientOperationError(e, { fallbackDetail: 'Décision impossible sur ce document.' });
      }
    } finally {
      setProcessingId(null);
    }
  };

  const accept = (task: PendingWorkflowTask) => {
    if (!confirm(`Confirmer : ${getActionLabel(task.expected_action_type)} ?`)) return;
    void decide(task, 'accept');
  };

  const getActionLabel = (type: string) => {
    switch (type) {
      case 'visa': return 'Viser';
      case 'approval': return 'Approuver';
      case 'final_signature': return 'Signer';
      case 'read_ack': return 'J\'ai pris connaissance';
      default: return 'Valider';
    }
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-700 h-full flex flex-col">
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-cam-yellow/10 text-cam-yellow rounded-full text-[9px] font-black uppercase tracking-[0.2em] mb-3 border border-cam-yellow/20">
          Pile de Décision
        </div>
        <h2 className="text-4xl font-black text-slate-900 tracking-tighter italic uppercase">Espace <span className="text-cam-yellow">Manager</span></h2>
        <p className="text-slate-500 mt-1 font-medium italic">Validez et signez les dossiers en attente de décision.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto p-1">
        {loading ? (
          <p className="text-slate-400 font-bold italic">Chargement du parapheur...</p>
        ) : documents.length === 0 ? (
          <div className="col-span-full py-20 text-center border-2 border-dashed border-slate-200 rounded-[3rem]">
            <span className="material-symbols-outlined text-6xl text-slate-200 mb-4">check_circle</span>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Aucun dossier en attente</p>
          </div>
        ) : (
          documents.map((item) => (
            <div key={item.id} className="glass p-6 rounded-[2rem] bg-white/60 border-white hover:shadow-2xl transition-all cursor-pointer group">
              <div className="flex justify-between items-start mb-4">
                <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-md bg-yellow-50 text-yellow-600`}>
                  En Attente
                </span>
                <span className="material-symbols-outlined text-slate-300 group-hover:text-cam-yellow transition-colors">draw</span>
              </div>
              <h4 className="font-black text-slate-800 text-lg leading-tight mb-2 italic line-clamp-2">"{item.document?.title || 'Document sans titre'}"</h4>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-6">Émis le: {new Date(item.created_at).toLocaleDateString()}</p>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setRejecting(item)}
                  disabled={processingId === item.id}
                  className="py-3 bg-slate-50 rounded-xl text-[10px] font-black uppercase text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all disabled:opacity-50"
                >
                  Rejeter
                </button>
                <button
                  onClick={() => accept(item)}
                  disabled={processingId === item.id}
                  className="py-3 bg-rdpc-blue text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-200 transition-all hover:bg-blue-800 disabled:opacity-50"
                >
                  {processingId === item.id ? '...' : getActionLabel(item.expected_action_type)}
                </button>
              </div>
            </div>
          )))}
      </div>

      <RejectReasonDialog
        documentTitle={rejecting ? rejecting.document?.title || 'Document sans titre' : null}
        submitting={rejecting !== null && processingId === rejecting.id}
        onConfirm={(reason) => rejecting && void decide(rejecting, 'reject', reason)}
        onCancel={() => setRejecting(null)}
      />
    </div>
  );
};

export default ValidationHub;
