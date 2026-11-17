
import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../../../services/api';
import { TenantMetrics } from '../../../types';
import { serviceIndicators } from './serviceIndicators';

const ServiceDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<TenantMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setLoadError(false);
    try {
      const data: TenantMetrics = await api.getTenantAnalytics();
      setMetrics(data);
    } catch (err) {
      console.error('Failed to fetch service dashboard:', err);
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const rows = metrics ? serviceIndicators(metrics) : [];

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-700">
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/10 text-blue-600 rounded-full text-[9px] font-black uppercase tracking-[0.2em] mb-3 border border-blue-500/20">
          Gestion de Service
        </div>
        <h2 className="text-4xl font-black text-slate-900 tracking-tighter italic uppercase">Chef <span className="text-blue-500">Unité</span></h2>
        <p className="text-slate-500 mt-1 font-medium italic">Supervisez les dossiers et la productivité de votre équipe.</p>
      </div>

      <div className="max-w-2xl">
        <div className="glass p-8 rounded-[2.5rem] bg-white border-white">
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-1 italic">Indicateurs du Service</h3>
          <p className="text-xs text-slate-500 mb-6">Votre service et ses sous-services.</p>
          {loadError ? (
            <div role="alert" className="p-4 rounded-2xl bg-red-50 text-red-700 text-sm font-medium flex items-center justify-between gap-3">
              <span>Chiffres indisponibles pour le moment.</span>
              <button
                type="button"
                onClick={() => { fetchData(); }}
                className="px-3 py-1.5 rounded-xl bg-white border border-red-200 text-xs font-black"
              >
                Réessayer
              </button>
            </div>
          ) : (
            <ul className="space-y-4" aria-label="Indicateurs du service" aria-busy={isLoading}>
              {(isLoading && !metrics ? serviceIndicators({} as TenantMetrics) : rows).map((stat) => (
                <li key={stat.label} className="flex justify-between items-center p-4 rounded-2xl border border-transparent">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-slate-400">{stat.icon}</span>
                    <span className="text-sm font-black text-slate-700">{stat.label}</span>
                  </div>
                  <span className="text-lg font-black text-slate-800">{isLoading ? '...' : stat.value}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default ServiceDashboard;
