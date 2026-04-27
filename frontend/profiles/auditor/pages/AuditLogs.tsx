import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../../../services/api';
import { AuditLogEntry } from '../../../types';

const AuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterTable, setFilterTable] = useState('');
  const [filterAction, setFilterAction] = useState('');

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params: { table_name?: string; action?: string; limit?: number } = { limit: 200 };
      if (filterTable) params.table_name = filterTable;
      if (filterAction) params.action = filterAction;
      const data = await api.getAuditLogs(params);
      setLogs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
      setError('Impossible de charger les logs d\'audit.');
    } finally {
      setIsLoading(false);
    }
  }, [filterTable, filterAction]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const actionStyle = (action: string) => {
    if (action === 'create') return 'bg-green-50 text-green-600';
    if (action === 'update') return 'bg-blue-50 text-blue-600';
    if (action === 'delete') return 'bg-red-50 text-red-600';
    return 'bg-slate-50 text-slate-500';
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-700">
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-purple-100 text-purple-600 rounded-full text-[9px] font-black uppercase tracking-[0.2em] mb-3 border border-purple-200">
          Integrite des Donnees
        </div>
        <h2 className="text-4xl font-black text-slate-900 tracking-tighter italic uppercase">Module <span className="text-purple-600">Compliance</span></h2>
        <p className="text-slate-500 mt-1 font-medium italic">Historique immuable des actions et acces aux documents.</p>
      </div>

      <div className="flex items-center gap-4">
        <select
          value={filterTable}
          onChange={e => setFilterTable(e.target.value)}
          className="px-5 py-3 bg-slate-50 border-none rounded-2xl text-xs font-black uppercase tracking-widest text-slate-500 outline-none cursor-pointer"
        >
          <option value="">Table : Toutes</option>
          <option value="documents">Documents</option>
          <option value="workflows">Workflows</option>
          <option value="users">Users</option>
          <option value="ged_rules">GED Rules</option>
        </select>
        <select
          value={filterAction}
          onChange={e => setFilterAction(e.target.value)}
          className="px-5 py-3 bg-slate-50 border-none rounded-2xl text-xs font-black uppercase tracking-widest text-slate-500 outline-none cursor-pointer"
        >
          <option value="">Action : Toutes</option>
          <option value="create">Create</option>
          <option value="update">Update</option>
          <option value="delete">Delete</option>
        </select>
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{logs.length} entrees</span>
      </div>

      <div className="glass rounded-[2.5rem] bg-white border-white overflow-hidden shadow-xl">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600"></div>
          </div>
        ) : error ? (
          <div className="text-center py-20 text-red-500 font-bold">{error}</div>
        ) : logs.length === 0 ? (
          <div className="text-center py-20">
            <span className="material-symbols-outlined text-6xl text-slate-200 mb-4">history</span>
            <p className="text-slate-400 font-bold text-lg">Aucun log d'audit disponible</p>
            <p className="text-slate-300 text-sm mt-1">Les evenements seront enregistres ici automatiquement.</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Horodatage</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Table</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Action</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Record ID</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">User ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 text-[11px] font-bold text-slate-500 font-mono">
                    {new Date(log.created_at).toLocaleString('fr-CM')}
                  </td>
                  <td className="px-6 py-4 text-[11px] font-black text-slate-600 uppercase tracking-tighter">
                    {log.table_name}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-0.5 text-[10px] font-black rounded-md uppercase ${actionStyle(log.action)}`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-[10px] font-mono text-slate-400 truncate max-w-[140px]">
                    {log.record_id}
                  </td>
                  <td className="px-6 py-4 text-[10px] font-mono text-slate-400 truncate max-w-[140px]">
                    {log.user_id || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default AuditLogs;
