import React from 'react';
import type { PendingWorkflowTask } from '../../types';
import { taskSubmissionLabel } from '../../lib/taskSubmission';

/** Qui a envoyé le document à valider, et quand (lot 12) ; rien si le serveur ne le dit pas. */
export const TaskSubmissionLine: React.FC<{ task: PendingWorkflowTask; className?: string }> = ({
  task,
  className = 'text-xs text-slate-500 mt-0.5',
}) => {
  const label = taskSubmissionLabel(task.submitted_by_name, task.created_at);
  return label ? (
    <p className={className} data-testid="task-submission">{label}</p>
  ) : null;
};
