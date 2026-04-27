
import React, { useState, useEffect } from 'react';
import { Icons } from '../constants';
import { WorkflowStep } from '../types';
import { api } from '../services/api';

const WorkflowTasks: React.FC = () => {
  const [tasks, setTasks] = useState<WorkflowStep[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const handleValidate = async (stepId: string, action: 'approve' | 'reject') => {
    const comment = action === 'reject' ? prompt('Motif du rejet :') : null;
    try {
      await api.validateWorkflowStep(stepId, action, comment || undefined);
      await fetchTasks();
    } catch (err) {
      console.error('Validation failed:', err);
    }
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-700">
      <div>
        <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Tâches & Validations</h2>
        <p className="text-slate-500 mt-1">Gérez les circuits de signature et de validation sous votre responsabilité.</p>
      </div>

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
            <div className="w-16 h-16 rounded-[1.5rem] flex items-center justify-center shrink-0 bg-blue-50 text-blue-500 shadow-blue-100 shadow-inner">
              <Icons.CheckCircle className="w-8 h-8" />
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest bg-blue-500 text-white">
                  Étape {task.step_order}
                </span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{task.status}</span>
              </div>
              <h3 className="text-lg font-bold text-slate-800">{task.label}</h3>
              <p className="text-sm text-slate-500">Document : <span className="font-bold text-slate-700">{task.document_id}</span></p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => handleValidate(task.id, 'approve')}
                className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-2xl text-xs font-bold transition-all shadow-lg shadow-green-100"
              >
                Valider
              </button>
              <button
                onClick={() => handleValidate(task.id, 'reject')}
                className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-2xl text-xs font-bold transition-all shadow-lg shadow-red-100"
              >
                Rejeter
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Visual Workflow Chart */}
      <div className="glass p-8 rounded-[2rem] border-white">
        <h3 className="text-lg font-bold text-slate-800 mb-8">Efficacité du Service (Délai moyen de validation)</h3>
        <div className="h-64 bg-slate-100/50 rounded-3xl flex items-center justify-center border border-dashed border-slate-200">
            <p className="text-slate-400 font-bold italic">Graphique de performance analytique bientôt disponible</p>
        </div>
      </div>
    </div>
  );
};

export default WorkflowTasks;
