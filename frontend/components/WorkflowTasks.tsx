import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { Icons } from '../constants';
import type { PendingWorkflowTask } from '../types';
import { api } from '../services/api';
import type { InboxScope, WorkflowDecision } from '../services/resources/workflows.api';
import { RejectReasonDialog } from './workflow/RejectReasonDialog';
import { ViewDocumentButton } from './workflow/ViewDocumentButton';
import { ApiError } from '../lib/errors';
import { pushClientOperationError } from '../lib/errors/clientOperationError';
import { useCan } from '../hooks/useCan';
import { useWorkflowInbox } from '../hooks/useWorkflowInbox';
import { workflowStepStatusLabel } from '../lib/workflowStepStatus';

type Tab = { scope: InboxScope; label: string; empty: string };

const MINE: Tab = { scope: 'mine', label: 'À moi', empty: 'Rien à valider pour vous.' };
const TABS: Tab[] = [
  MINE,
  { scope: 'unit', label: 'Mon unité', empty: 'Rien en attente dans votre unité.' },
  { scope: 'unassigned', label: 'Sans validateur', empty: 'Aucune étape bloquée.' },
];

const HELP =
  'À moi : vos validations. Mon unité : ce qui attend dans votre service. Sans validateur : étapes à confier à quelqu’un.';

const WorkflowTasks: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const can = useCan('workflows:read', 'workflows:manage');
  const [recursive, setRecursive] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<PendingWorkflowTask | null>(null);
  const [legacy, setLegacy] = useState(false);

  // « Mon unité » n'existe qu'avec la file unifiée ; « Sans validateur » demande le droit de gérer les circuits.
  const visible = TABS.filter(
    (t) =>
      t.scope === 'mine' ||
      (t.scope === 'unit' && can['workflows:read'] && !legacy) ||
      (t.scope === 'unassigned' && can['workflows:manage']),
  );
  // Un onglet absent (droits pas encore connus ou refusés) n'est jamais interrogé : retour à « À moi ».
  const current = visible.find((t) => t.scope === searchParams.get('file')) ?? MINE;
  const { scope } = current;
  const inbox = useWorkflowInbox(scope, { recursive: scope === 'unit' && recursive });

  useEffect(() => {
    if (inbox.source === 'legacy') setLegacy(true);
  }, [inbox.source]);

  const selectTab = (next: InboxScope) => {
    const params = new URLSearchParams(searchParams);
    if (next === 'mine') params.delete('file');
    else params.set('file', next);
    setSearchParams(params, { replace: true });
  };

  const decide = async (task: PendingWorkflowTask, decision: WorkflowDecision, comment?: string) => {
    setProcessingId(task.id);
    try {
      await api.decideWorkflowStep(task, decision, comment);
      setRejecting(null);
      inbox.remove(task.id);
    } catch (err) {
      // Les erreurs HTTP sont déjà affichées par le bus global ; reste le cas local (version absente).
      if (!(err instanceof ApiError)) {
        pushClientOperationError(err, { fallbackDetail: 'Décision impossible sur ce document.' });
      }
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-700">
      <div className="flex items-start gap-2">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Tâches & Validations</h2>
          <p className="text-slate-500 mt-1">Les étapes de validation qui attendent une décision.</p>
        </div>
        <span
          className="material-symbols-outlined mt-2 cursor-help text-[20px] text-slate-400 hover:text-rdpc-blue"
          title={HELP}
          aria-label={HELP}
          role="img"
        >
          help
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="Files de validation" className="inline-flex rounded-2xl bg-slate-100 p-1">
          {visible.map((t) => (
            <button
              key={t.scope}
              type="button"
              role="tab"
              aria-selected={t.scope === scope}
              onClick={() => selectTab(t.scope)}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                t.scope === scope ? 'bg-white text-slate-900 shadow' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {t.label}
              {t.scope === scope && !inbox.loading && (
                <span className="ml-2 rounded-full bg-slate-900 px-2 py-0.5 text-[10px] text-white">{inbox.total}</span>
              )}
            </button>
          ))}
        </div>
        {scope === 'unit' && (
          <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-600">
            <input type="checkbox" checked={recursive} onChange={(e) => setRecursive(e.target.checked)} />
            Inclure les sous-unités
          </label>
        )}
      </div>

      {inbox.loading && inbox.items.length === 0 && (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-rdpc-blue"></div>
        </div>
      )}

      {inbox.failed && inbox.items.length === 0 && (
        <div className="text-center py-20 text-red-500 font-bold">Impossible de charger cette file.</div>
      )}

      {!inbox.loading && !inbox.failed && inbox.items.length === 0 && (
        <div className="glass p-12 rounded-[2rem] border-white text-center">
          <span className="material-symbols-outlined text-6xl text-slate-200 mb-4">task_alt</span>
          <p className="text-slate-400 font-bold text-lg">{current.empty}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6">
        {inbox.items.map((task) => (
          <div
            key={task.id}
            aria-label={task.document?.title || task.label}
            className="glass p-6 rounded-[2rem] border-white group hover:shadow-2xl hover:bg-white transition-all flex items-center gap-6"
          >
            <div className="w-16 h-16 rounded-[1.5rem] flex items-center justify-center shrink-0 bg-blue-50 text-blue-500 shadow-blue-100 shadow-inner">
              <Icons.CheckCircle className="w-8 h-8" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest bg-blue-500 text-white">
                  Étape {task.step_order}
                </span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{workflowStepStatusLabel(task.status)}</span>
              </div>
              <h3 className="text-lg font-bold text-slate-800">{task.label}</h3>
              <p className="text-sm text-slate-500 truncate">
                Document : <span className="font-bold text-slate-700">{task.document?.title || 'Document sans titre'}</span>
              </p>
              {scope === 'unassigned' && task.assignment_error && (
                <p className="mt-2 text-xs text-amber-700">{task.assignment_error}</p>
              )}
              <div className="mt-2"><ViewDocumentButton documentId={task.document_id} /></div>
            </div>

            {scope === 'mine' && (
              <div className="flex gap-3">
                <button
                  onClick={() => decide(task, 'accept')}
                  disabled={processingId === task.id}
                  className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-2xl text-xs font-bold transition-all shadow-lg shadow-green-100 disabled:opacity-50"
                >
                  Valider
                </button>
                <button
                  onClick={() => setRejecting(task)}
                  disabled={processingId === task.id}
                  className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-2xl text-xs font-bold transition-all shadow-lg shadow-red-100 disabled:opacity-50"
                >
                  Rejeter
                </button>
              </div>
            )}
            {scope === 'unit' && (
              <span className="shrink-0 rounded-full bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-amber-600">
                En attente
              </span>
            )}
            {scope === 'unassigned' && (
              <Link
                to="/pending-assignments"
                className="shrink-0 px-6 py-3 bg-rdpc-blue hover:bg-blue-800 text-white rounded-2xl text-xs font-bold transition-all"
              >
                Assigner
              </Link>
            )}
          </div>
        ))}
      </div>

      {inbox.hasMore && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => inbox.loadMore()}
            disabled={inbox.loading}
            className="rounded-2xl border-2 border-slate-200 bg-white px-6 py-3 text-xs font-bold text-slate-700 hover:border-rdpc-blue hover:text-rdpc-blue disabled:opacity-50"
          >
            Voir plus
          </button>
        </div>
      )}

      <RejectReasonDialog
        documentTitle={rejecting ? rejecting.document?.title || rejecting.label : null}
        submitting={rejecting !== null && processingId === rejecting.id}
        onConfirm={(reason) => {
          if (rejecting) decide(rejecting, 'reject', reason);
        }}
        onCancel={() => setRejecting(null)}
      />
    </div>
  );
};

export default WorkflowTasks;
