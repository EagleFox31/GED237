
import React, { useCallback, useState, useEffect } from 'react';
import { Icons } from '../constants';
import type { PendingWorkflowTask } from '../types';
import { api } from '../services/api';
import type { WorkflowDecision } from '../services/resources/workflows.api';
import { RejectReasonDialog } from './workflow/RejectReasonDialog';
import { ViewDocumentButton } from './workflow/ViewDocumentButton';
import { ApiError } from '../lib/errors';
import { pushClientOperationError } from '../lib/errors/clientOperationError';
import { workflowStepStatusLabel } from '../lib/workflowStepStatus';
import { ConfirmationModal } from './ui/ConfirmationModal';
import { bulkConfirmTitle, bulkDecide, bulkDoneLabel, type BulkOutcome } from '../lib/bulkDecide';

const taskTitle = (task: PendingWorkflowTask) => task.document?.title || 'Document sans titre';

const WorkflowTasks: React.FC = () => {
  const [tasks, setTasks] = useState<PendingWorkflowTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<PendingWorkflowTask | null>(null);
  // Visa en lot : sélection, confirmation unique, avancement et bilan par tâche.
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ handled: number; total: number } | null>(null);
  const [bulkOutcome, setBulkOutcome] = useState<BulkOutcome | null>(null);

  const selectedTasks = tasks.filter((t) => selected.has(t.id));
  const allSelected = tasks.length > 0 && selectedTasks.length === tasks.length;
  const busy = bulkProgress !== null;

  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  // Stable : ConfirmationModal réabonne Échap à chaque nouvelle référence.
  const cancelBulk = useCallback(() => setConfirmBulk(false), []);
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(tasks.map((t) => t.id)));

  const fetchTasks = async () => {
    try {
      const data = await api.getPendingWorkflows();
      setTasks(data);
    } catch (err) {
      console.error('Failed to fetch pending workflows:', err);
      setError('Impossible de charger les tâches en attente.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const decide = async (task: PendingWorkflowTask, decision: WorkflowDecision, comment?: string) => {
    setProcessingId(task.id);
    try {
      await api.decideWorkflowStep(task, decision, comment);
      setRejecting(null);
      await fetchTasks();
    } catch (err) {
      // Les erreurs HTTP sont déjà affichées par le bus global ; reste le cas local (version absente).
      if (!(err instanceof ApiError)) {
        pushClientOperationError(err, { fallbackDetail: 'Décision impossible sur ce document.' });
      }
    } finally {
      setProcessingId(null);
    }
  };

  const runBulk = async () => {
    const batch = selectedTasks;
    setConfirmBulk(false);
    setBulkOutcome(null);
    setBulkProgress({ handled: 0, total: batch.length });
    // `silent` : pas un toast par tâche, le bilan ci-dessous liste chaque échec.
    const outcome = await bulkDecide(
      batch.map((task) => ({ ...task, title: taskTitle(task) })),
      (task) => api.decideWorkflowStep(task, 'accept', undefined, { silent: true }),
      (handled) => setBulkProgress({ handled, total: batch.length }),
    );
    setBulkProgress(null);
    setBulkOutcome(outcome);
    // Les tâches en échec restent cochées : on peut corriger puis relancer.
    setSelected(new Set(outcome.failed.map((f) => f.id)));
    await fetchTasks();
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Tâches & Validations</h2>
          <p className="text-slate-500 mt-1">Gérez les circuits de signature et de validation sous votre responsabilité.</p>
        </div>
        {tasks.length > 0 && (
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-xs font-bold text-slate-500 cursor-pointer">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                disabled={busy}
                className="h-4 w-4 accent-rdpc-blue"
              />
              Tout sélectionner
            </label>
            <button
              type="button"
              data-testid="bulk-approve"
              onClick={() => setConfirmBulk(true)}
              disabled={busy || selectedTasks.length === 0}
              className="px-5 py-3 bg-green-500 hover:bg-green-600 text-white rounded-2xl text-xs font-bold transition-all shadow-lg shadow-green-100 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rdpc-blue"
            >
              {bulkProgress
                ? `Visa en cours… ${bulkProgress.handled}/${bulkProgress.total}`
                : `Viser la sélection (${selectedTasks.length})`}
            </button>
          </div>
        )}
      </div>

      {bulkOutcome && (
        <div data-testid="bulk-outcome" className="space-y-2">
          {bulkOutcome.done.length > 0 && (
            <p role="status" className="text-sm font-bold text-green-700">{bulkDoneLabel(bulkOutcome.done.length)}</p>
          )}
          {bulkOutcome.failed.length > 0 && (
            <div role="alert" className="text-sm text-red-700">
              <p className="font-bold">
                {bulkOutcome.failed.length === 1 ? '1 tâche non visée :' : `${bulkOutcome.failed.length} tâches non visées :`}
              </p>
              <ul className="mt-1 list-disc pl-5">
                {bulkOutcome.failed.map((f) => (
                  <li key={f.id}><span className="font-bold">{f.title}</span> — {f.message}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-rdpc-blue"></div>
        </div>
      )}

      {error && (
        <div className="text-center py-20 text-red-500 font-bold">{error}</div>
      )}

      {!isLoading && !error && tasks.length === 0 && (
        <div className="glass p-12 rounded-[2rem] border-white text-center">
          <span className="material-symbols-outlined text-6xl text-slate-200 mb-4">task_alt</span>
          <p className="text-slate-400 font-bold text-lg">Aucune tâche en attente</p>
          <p className="text-slate-300 text-sm mt-1">Toutes les validations sont à jour.</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6">
        {tasks.map((task) => (
          <div key={task.id} className="glass p-6 rounded-[2rem] border-white group hover:shadow-2xl hover:bg-white transition-all flex items-center gap-6">
            <input
              type="checkbox"
              checked={selected.has(task.id)}
              onChange={() => toggleOne(task.id)}
              disabled={busy}
              aria-label={`Sélectionner « ${taskTitle(task)} »`}
              className="h-5 w-5 shrink-0 accent-rdpc-blue"
            />
            <div className="w-16 h-16 rounded-[1.5rem] flex items-center justify-center shrink-0 bg-blue-50 text-blue-500 shadow-blue-100 shadow-inner">
              <Icons.CheckCircle className="w-8 h-8" />
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest bg-blue-500 text-white">
                  Étape {task.step_order}
                </span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{workflowStepStatusLabel(task.status)}</span>
              </div>
              <h3 className="text-lg font-bold text-slate-800">{task.label}</h3>
              <p className="text-sm text-slate-500">Document : <span className="font-bold text-slate-700">{taskTitle(task)}</span></p>
              <div className="mt-2"><ViewDocumentButton documentId={task.document_id} /></div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => decide(task, 'accept')}
                disabled={busy || processingId === task.id}
                className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-2xl text-xs font-bold transition-all shadow-lg shadow-green-100 disabled:opacity-50"
              >
                Valider
              </button>
              <button
                onClick={() => setRejecting(task)}
                disabled={busy || processingId === task.id}
                className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-2xl text-xs font-bold transition-all shadow-lg shadow-red-100 disabled:opacity-50"
              >
                Rejeter
              </button>
            </div>
          </div>
        ))}
      </div>

      <RejectReasonDialog
        documentTitle={rejecting ? rejecting.document?.title || rejecting.label : null}
        submitting={rejecting !== null && processingId === rejecting.id}
        onConfirm={(reason) => rejecting && void decide(rejecting, 'reject', reason)}
        onCancel={() => setRejecting(null)}
      />

      <ConfirmationModal
        open={confirmBulk}
        title={bulkConfirmTitle(selectedTasks.length)}
        message="Chaque document sélectionné sera visé, l'un après l'autre. Si un visa échoue, les autres restent faits."
        confirmLabel="Viser"
        icon="task_alt"
        onCancel={cancelBulk}
        onConfirm={() => void runBulk()}
      >
        <ul data-testid="bulk-confirm-list" className="mt-3 max-h-48 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 space-y-1 text-[13px] text-slate-700">
          {selectedTasks.map((task) => (
            <li key={task.id}>{taskTitle(task)}</li>
          ))}
        </ul>
      </ConfirmationModal>

    </div>
  );
};

export default WorkflowTasks;
