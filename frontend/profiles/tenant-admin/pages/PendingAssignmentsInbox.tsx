// frontend/profiles/tenant-admin/pages/PendingAssignmentsInbox.tsx
import React, { useState, useEffect } from 'react';
import { api } from '../../../services/api';

const PendingAssignmentsInbox: React.FC = () => {
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<any | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    fetchAssignments();
    fetchUsers();
  }, []);

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      const data = await api.getPendingAssignments();
      setAssignments(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const data = await api.getUsers();
      setUsers(data);
    } catch (e) {
      console.error(e);
    }
  };

  const assignStep = async () => {
    if (!selectedAssignment || !selectedUserId) return;

    try {
      setAssigning(true);
      await api.assignPendingStep(selectedAssignment.id, selectedUserId);
      setAssignments(assignments.filter(a => a.id !== selectedAssignment.id));
      setSelectedAssignment(null);
      setSelectedUserId('');
    } catch (e) {
      console.error(e);
      alert('Erreur lors de l\'assignation.');
    } finally {
      setAssigning(false);
    }
  };

  const filtered = assignments.filter(a =>
    a.document?.title?.toLowerCase().includes(search.toLowerCase()) ||
    a.label.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8 pb-32">
      <div className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-4xl font-black text-slate-800 tracking-tighter uppercase italic flex items-center gap-3">
            <span className="material-symbols-outlined text-4xl text-rdpc-blue">assignment_ind</span>
            Orphelins & Assignations Manuelles
          </h1>
          <p className="text-slate-500 font-medium italic mt-2">
            Étapes de circuit dont la résolution automatique a échoué. Assignez un acteur manuellement.
          </p>
        </div>
      </div>

      <div className="flex gap-4 mb-8">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">search</span>
          <input
            type="text"
            placeholder="Rechercher par document ou étape..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white border-2 border-slate-200 rounded-3xl py-4 pl-12 pr-6 text-slate-700 font-medium italic focus:outline-none focus:border-rdpc-blue transition-colors"
          />
        </div>
        <button onClick={fetchAssignments} className="bg-white border-2 border-slate-200 text-slate-700 w-14 rounded-3xl flex items-center justify-center hover:border-rdpc-blue hover:text-rdpc-blue transition-colors">
          <span className="material-symbols-outlined">refresh</span>
        </button>
      </div>

      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-12 lg:col-span-7 space-y-4">
          {loading ? (
             <div className="text-slate-500 italic p-8 text-center bg-white rounded-[2rem] shadow-sm">Chargement...</div>
          ) : filtered.length === 0 ? (
            <div className="text-slate-500 italic p-8 text-center bg-white rounded-[2rem] shadow-sm">
              <span className="material-symbols-outlined text-4xl mb-2 opacity-50">done_all</span>
              <p>Aucune étape orpheline.</p>
            </div>
          ) : (
            filtered.map((item) => (
              <div
                key={item.id}
                className={`p-6 rounded-[2rem] border-2 cursor-pointer transition-all ${selectedAssignment?.id === item.id ? 'border-rdpc-blue bg-blue-50 shadow-md' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                onClick={() => setSelectedAssignment(item)}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-2xl text-amber-500">warning</span>
                    <div>
                      <h3 className="font-bold text-slate-800 text-lg uppercase italic tracking-tight">{item.document?.title || "Document Inconnu"}</h3>
                      <p className="text-sm font-medium text-slate-500">Étape: {item.label} (Ordre: {item.step_order})</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded-full italic uppercase tracking-wider">Bloqué</span>
                </div>
                {item.assignment_error && (
                   <p className="text-sm text-slate-600 bg-slate-50 p-4 rounded-2xl italic font-medium">Erreur: {item.assignment_error}</p>
                )}
                {item.comment && !item.assignment_error && (
                   <p className="text-sm text-slate-600 bg-slate-50 p-4 rounded-2xl italic font-medium">Erreur: {item.comment}</p>
                )}
              </div>
            ))
          )}
        </div>

        <div className="col-span-12 lg:col-span-5">
          {selectedAssignment ? (
            <div className="bg-white border-2 border-slate-200 rounded-[2rem] p-8 shadow-xl sticky top-8">
               <h2 className="text-2xl font-black text-slate-800 tracking-tighter uppercase italic mb-6 text-center">Débloquer l'Étape</h2>

               <div className="space-y-6">
                 <div>
                    <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider mb-2">Acteur Manuel</label>
                    <select
                      value={selectedUserId}
                      onChange={(e) => setSelectedUserId(e.target.value)}
                      className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl p-4 text-slate-700 font-medium italic focus:outline-none focus:border-rdpc-blue transition-colors"
                    >
                      <option value="">-- Sélectionner un utilisateur --</option>
                      {users.map(u => (
                         <option key={u.id} value={u.id}>{u.full_name} ({u.role_label})</option>
                      ))}
                    </select>
                 </div>

                 <button
                  onClick={assignStep}
                  disabled={!selectedUserId || assigning}
                  className="w-full bg-rdpc-blue text-white py-4 rounded-2xl font-bold uppercase italic tracking-wider hover:bg-black transition-colors disabled:opacity-50"
                 >
                   {assigning ? 'Assignation...' : 'Forcer l\'Assignation'}
                 </button>
               </div>
            </div>
          ) : (
            <div className="bg-slate-100 rounded-[2rem] p-12 text-center text-slate-400 border-2 border-dashed border-slate-200 flex flex-col items-center justify-center min-h-[400px]">
               <span className="material-symbols-outlined text-6xl mb-4 opacity-50">touch_app</span>
               <p className="font-bold uppercase tracking-widest italic text-sm">Sélectionnez une étape<br/>pour gérer l'assignation</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PendingAssignmentsInbox;
