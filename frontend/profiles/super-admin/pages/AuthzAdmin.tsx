import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../../services/api';
import { AuthzMetricPoint, AuthzHealthResponse } from '../../../types';
import { useAuthStore } from '../../../stores/authStore';
import RightsGridTab from './RightsGridTab';

type TabId = 'policies' | 'metrics' | 'health';

// ─── Metrics Tab ──────────────────────────────────────────

const MetricsTab: React.FC = () => {
  const [metrics, setMetrics] = useState<AuthzMetricPoint[]>([]);
  const [topDenies, setTopDenies] = useState<AuthzMetricPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterDecision, setFilterDecision] = useState<string>('');

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const filters: { decision?: string } = {};
      if (filterDecision) filters.decision = filterDecision;

      const [metricsData, deniesData] = await Promise.all([
        api.getAuthzMetrics(filters),
        api.getAuthzTopDenies({ top_n: 10 }),
      ]);
      setMetrics(metricsData);
      setTopDenies(deniesData);
    } catch (err) {
      console.error('Failed to fetch metrics:', err);
    } finally {
      setIsLoading(false);
    }
  }, [filterDecision]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleReset = async () => {
    if (!confirm('Remettre les compteurs de metriques a zero ?')) return;
    try {
      await api.resetAuthzMetrics();
      fetchData();
    } catch (err) {
      console.error('Reset failed:', err);
    }
  };

  if (isLoading) return <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cam-red"></div></div>;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <select value={filterDecision} onChange={e => setFilterDecision(e.target.value)} className="px-4 py-3 bg-slate-50 border-none rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 outline-none cursor-pointer">
            <option value="">Toutes decisions</option>
            <option value="allow">Allow</option>
            <option value="deny">Deny</option>
          </select>
        </div>
        <button type="button" onClick={handleReset} className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:scale-105 transition-transform">
          <span className="material-symbols-outlined text-sm">restart_alt</span>
          Reset Compteurs
        </button>
      </div>

      {topDenies.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-black uppercase tracking-widest text-red-500">Top Refus (Deny)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {topDenies.map((d, i) => (
              <div key={i} className="glass p-4 rounded-2xl border border-red-100 flex items-center justify-between">
                <div>
                  <span className="text-sm font-bold text-slate-700">{d.role}</span>
                  <span className="text-slate-300 mx-2">→</span>
                  <span className="text-sm font-medium text-slate-600">{d.resource}</span>
                  <span className="text-slate-300 mx-2">:</span>
                  <span className="px-2 py-0.5 bg-red-50 text-red-600 text-[10px] font-black rounded-md uppercase">{d.action}</span>
                </div>
                <span className="text-lg font-black text-red-500">{d.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="glass rounded-[2rem] bg-white border-white overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/50">
              <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Decision</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Role</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Resource</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Action</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Count</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {metrics.map((m, i) => (
              <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-3">
                  <span className={`px-2 py-0.5 text-[10px] font-black rounded-md uppercase ${m.decision === 'allow' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>{m.decision}</span>
                </td>
                <td className="px-6 py-3 text-sm font-bold text-slate-700">{m.role}</td>
                <td className="px-6 py-3 text-sm font-medium text-slate-600">{m.resource}</td>
                <td className="px-6 py-3 text-sm font-medium text-slate-500">{m.action}</td>
                <td className="px-6 py-3 text-sm font-black text-slate-800">{m.count}</td>
              </tr>
            ))}
            {metrics.length === 0 && (
              <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-bold">Aucune metrique disponible</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─── Health Tab ──────────────────────────────────────────

const HealthTab: React.FC = () => {
  const [health, setHealth] = useState<AuthzHealthResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const data = await api.getAuthzHealth();
        setHealth(data);
      } catch (err) {
        console.error('Failed to fetch health:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetch();
  }, []);

  if (isLoading) return <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cam-red"></div></div>;
  if (!health) return <div className="text-center py-20 text-red-500 font-bold">Erreur de chargement</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="glass p-8 rounded-[2.5rem] border border-white text-center space-y-4">
        <span className="material-symbols-outlined text-4xl text-slate-400">database</span>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Backend Metriques</p>
        <p className="text-2xl font-black text-slate-800 uppercase">{health.backend}</p>
      </div>

      <div className="glass p-8 rounded-[2.5rem] border border-white text-center space-y-4">
        <span className={`material-symbols-outlined text-4xl ${health.degraded ? 'text-red-500' : 'text-green-500'}`}>
          {health.degraded ? 'error' : 'check_circle'}
        </span>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">État</p>
        <p className={`text-2xl font-black uppercase ${health.degraded ? 'text-red-500' : 'text-green-600'}`}>
          {health.degraded ? 'Degrade' : 'Operationnel'}
        </p>
      </div>

      <div className="glass p-8 rounded-[2.5rem] border border-white text-center space-y-4">
        <span className={`material-symbols-outlined text-4xl ${health.dropped_count > 0 ? 'text-yellow-500' : 'text-green-500'}`}>
          {health.dropped_count > 0 ? 'warning' : 'verified'}
        </span>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Metriques perdues</p>
        <p className={`text-2xl font-black ${health.dropped_count > 0 ? 'text-yellow-600' : 'text-green-600'}`}>
          {health.dropped_count}
        </p>
      </div>
    </div>
  );
};

// ─── Main Page ──────────────────────────────────────────

const AuthzAdmin: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('policies');
  // L'admin ministère ne voit que la grille, en lecture (#280) : métriques et santé restent au super-admin.
  const isSuper = useAuthStore((s) => s.userProfile?.id) === 'super';

  const tabs: { id: TabId; label: string; icon: string }[] = [
    { id: 'policies', label: 'Droits', icon: 'policy' },
    { id: 'metrics', label: 'Metriques', icon: 'monitoring' },
    { id: 'health', label: 'Sante', icon: 'health_and_safety' },
  ];

  return (
    <div className="p-8 pb-32 flex flex-col h-full animate-in fade-in duration-500">
      <div className="flex justify-between items-center mb-8 shrink-0">
        <div>
          <h1 className="text-4xl font-black text-slate-800 tracking-tighter uppercase italic flex items-center gap-3">
            <span className="material-symbols-outlined text-4xl text-cam-red">admin_panel_settings</span>
            Droits d'accès
          </h1>
          <p className="text-slate-500 font-medium italic mt-2">Qui peut faire quoi, rôle par rôle.</p>
        </div>
      </div>

      <div className={`flex gap-4 mb-6 border-b-2 border-slate-200 shrink-0 ${isSuper ? '' : 'hidden'}`}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            className={`pb-4 px-4 text-xs font-black uppercase tracking-widest transition-colors flex items-center gap-2 ${
              activeTab === tab.id
                ? 'text-cam-red border-b-4 border-cam-red mb-[-2px]'
                : 'text-slate-400 hover:text-slate-700'
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span aria-hidden="true" className="material-symbols-outlined text-lg">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {(activeTab === 'policies' || !isSuper) && <RightsGridTab />}
        {isSuper && activeTab === 'metrics' && <MetricsTab />}
        {isSuper && activeTab === 'health' && <HealthTab />}
      </div>
    </div>
  );
};

export default AuthzAdmin;
