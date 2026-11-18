
import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../../services/api';
import type { WorkflowDecision } from '../../../services/resources/workflows.api';
import type { PendingWorkflowTask } from '../../../types';
import { RejectReasonDialog } from '../../../components/workflow/RejectReasonDialog';
import { ViewDocumentButton } from '../../../components/workflow/ViewDocumentButton';
import { ConfirmationModal } from '../../../components/ui/ConfirmationModal';
import { ApiError } from '../../../lib/errors';
import { pushClientOperationError } from '../../../lib/errors/clientOperationError';
import {
  countTasksByActionType,
  executeBatchReadAck,
  filterTasksByActionType,
  isBatchReadAckAvailable,
  type TaskActionFilter,
} from '../../../lib/workflowBatch';

const ValidationHub: React.FC = () => {
  const [documents, setDocuments] = useState<PendingWorkflowTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<PendingWorkflowTask | null>(null);
  const [accepting, setAccepting] = useState<PendingWorkflowTask | null>(null);
  const [actionFilter, setActionFilter] = useState<TaskActionFilter>('all');
  const [confirmBatchAck, setConfirmBatchAck] = useState(false);
  const [batchProcessing, setBatchProcessing] = useState(false);

  const actionCounts = useMemo(() => countTasksByActionType(documents), [documents]);
  const visibleDocuments = useMemo(
    () => filterTasksByActionType(documents, actionFilter),
    [documents, actionFilter],
  );
  const canBatchAck = isBatchReadAckAvailable(actionFilter, visibleDocuments);

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

  const getActionLabel = (type: string) => {
    switch (type) {
      case 'visa': return 'Viser';
      case 'approval': return 'Approuver';
      case 'final_signature': return 'Signer';
      case 'read_ack': return 'J\'ai pris connaissance';
      default: return 'Valider';
    }
  };

  const runBatchReadAck = async () => {
    setConfirmBatchAck(false);
    setBatchProcessing(true);
    try {
      const { succeededIds, failedCount } = await executeBatchReadAck(
        visibleDocuments,
        (task) => api.decideWorkflowStep(task, 'accept'),
      );
      if (succeededIds.length > 0) {
        const doneSet = new Set(succeededIds);
        setDocuments((prev) => prev.filter((d) => !doneSet.has(d.id)));
      }
      if (failedCount > 0) {
        pushClientOperationError(null, {
          fallbackDetail: `${failedCount} prise(s) de connaissance ont échoué.`,
          severity: 'warning',
        });
      }
    } finally {
      setBatchProcessing(false);
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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtrer par type d action">
          {(
            [
              { id: 'all', label: 'Toutes', count: actionCounts.all },
              { id: 'read_ack', label: 'Prises de connaissance', count: actionCounts.read_ack },
              { id: 'visa', label: 'Visas', count: actionCounts.visa },
              { id: 'approval', label: 'Approbations', count: actionCounts.approval },
              { id: 'final_signature', label: 'Signatures', count: actionCounts.final_signature },
            ] as Array<{ id: TaskActionFilter; label: string; count: number }>
          ).map((chip) => {
            const active = actionFilter === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => setActionFilter(chip.id)}
                aria-pressed={active}
                className={`px-3.5 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all ${
                  active
                    ? 'bg-rdpc-blue text-white shadow-md shadow-blue-100'
                    : 'bg-white text-slate-600 border border-slate-200 hover:border-rdpc-blue/40 hover:text-rdpc-blue'
                }`}
              >
                {chip.label} ({chip.count})
              </button>
            );
          })}
        </div>

        {canBatchAck && (
          <button
            type="button"
            disabled={batchProcessing}
            onClick={() => setConfirmBatchAck(true)}
            data-testid="batch-read-ack"
            className="px-4 py-2.5 bg-rdpc-blue text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-blue-200 hover:bg-blue-800 transition-all disabled:opacity-50"
          >
            {batchProcessing ? 'Traitement...' : `Tout marquer comme lu (${visibleDocuments.length})`}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto p-1">
        {loading ? (
          <p className="text-slate-400 font-bold italic">Chargement du parapheur...</p>
        ) : visibleDocuments.length === 0 ? (
          <div className="col-span-full py-20 text-center border-2 border-dashed border-slate-200 rounded-[3rem]">
            <span className="material-symbols-outlined text-6xl text-slate-200 mb-4">check_circle</span>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Aucun dossier en attente</p>
          </div>
        ) : (
          visibleDocuments.map((item) => (
            <div key={item.id} className="glass p-6 rounded-[2rem] bg-white/60 border-white hover:shadow-2xl transition-all group">
              <div className="flex justify-between items-start mb-4">
                <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-md bg-yellow-50 text-yellow-600`}>
                  En Attente
                </span>
                <span className="material-symbols-outlined text-slate-300 group-hover:text-cam-yellow transition-colors">draw</span>
              </div>
              <h4 className="font-black text-slate-800 text-lg leading-tight mb-2 italic line-clamp-2">"{item.document?.title || 'Document sans titre'}"</h4>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-6">Émis le: {new Date(item.created_at).toLocaleDateString()}</p>

              <div className="mb-3">
                <ViewDocumentButton
                  documentId={item.document_id}
                  approveLabel={getActionLabel(item.expected_action_type)}
                  onApprove={() => setAccepting(item)}
                  onReject={() => setRejecting(item)}
                  decisionDisabled={processingId === item.id}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setRejecting(item)}
                  disabled={processingId === item.id}
                  className="py-3 bg-slate-50 rounded-xl text-[10px] font-black uppercase text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all disabled:opacity-50"
                >
                  Rejeter
                </button>
                <button
                  onClick={() => setAccepting(item)}
                  disabled={processingId === item.id}
                  className="py-3 bg-rdpc-blue text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-200 transition-all hover:bg-blue-800 disabled:opacity-50"
                >
                  {processingId === item.id ? '...' : getActionLabel(item.expected_action_type)}
                </button>
              </div>
            </div>
          )))}
      </div>

      <ConfirmationModal
        open={accepting !== null}
        title={accepting ? getActionLabel(accepting.expected_action_type) : ""}
        message={accepting ? `« ${accepting.document?.title || "Document sans titre"} »` : ""}
        confirmLabel="Confirmer"
        onCancel={() => setAccepting(null)}
        onConfirm={() => {
          const task = accepting;
          setAccepting(null);
          if (task) void decide(task, "accept");
        }}
      />

      <ConfirmationModal
        open={confirmBatchAck}
        title="Prise de connaissance groupée"
        message={`Confirmer la prise de connaissance de ${visibleDocuments.length} document(s) ?`}
        confirmLabel="Tout marquer comme lu"
        onCancel={() => setConfirmBatchAck(false)}
        onConfirm={() => void runBatchReadAck()}
      />

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
