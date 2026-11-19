import React from 'react';
import type { PendingWorkflowTask } from '../../types';
import { taskSubmissionSummary } from '../../lib/taskSubmission';

/**
 * Qui a envoyé le document à valider, et depuis quand ; date exacte en infobulle.
 * Partagé par /tasks et le parapheur du tableau de bord. Rien si le serveur ne le dit pas.
 */
export const TaskSubmissionLine: React.FC<{ task: PendingWorkflowTask; className?: string }> = ({
  task,
  className = 'text-xs text-slate-500 mt-0.5',
}) => {
  const summary = taskSubmissionSummary(task.submitted_by_name, task.created_at);
  return summary ? (
    <p className={className} title={summary.exact} data-testid="task-submission">
      {summary.text}
    </p>
  ) : null;
};
