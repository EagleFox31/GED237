
import React, { useEffect, useState } from 'react';
import { api } from '../../../services/api';
import { TenantMetrics } from '../../../types';

const ServiceDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<TenantMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await api.getTenantAnalytics();
        setMetrics(data);
      } catch (err) {
        console.error('Failed to fetch service dashboard:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-700">
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/10 text-blue-600 rounded-full text-[9px] font-black uppercase tracking-[0.2em] mb-3 border border-blue-500/20">
          Gestion de Service
        </div>
        <h2 className="text-4xl font-black text-slate-900 tracking-tighter italic uppercase">Chef <span className="text-blue-500">Unité</span></h2>
        <p className="text-slate-500 mt-1 font-medium italic">Supervisez les dossiers et la productivité de votre équipe.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="glass p-8 rounded-[2.5rem] bg-white border-white">
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6 italic">Indicateurs du Service</h3>
          <div className="space-y-4">
            {[
              { label: "Documents", count: isLoading ? '...' : metrics?.documents?.total ?? 0, icon: "description" },
              { label: "Workflows en attente", count: isLoading ? '...' : metrics?.workflows?.pending ?? 0, icon: "pending_actions" },
              { label: "Workflows complétés", count: isLoading ? '...' : metrics?.workflows?.completed ?? 0, icon: "task_alt" },
            ].map((stat, i) => (
              <div key={i} className="flex justify-between items-center p-4 hover:bg-slate-50 rounded-2xl transition-colors cursor-pointer group border border-transparent hover:border-slate-100">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-slate-400">{stat.icon}</span>
                  <span className="text-sm font-black text-slate-700 group-hover:text-blue-600">{stat.label}</span>
                </div>
                <span className="text-lg font-black text-slate-800">{stat.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass p-8 rounded-[2.5rem] bg-gradient-to-br from-blue-600 to-blue-800 text-white relative overflow-hidden">
          <div className="relative z-10">
            <h3 className="text-2xl font-black italic uppercase tracking-tighter mb-4">Planification <br/>de Service</h3>
            <p className="text-blue-100/70 text-xs font-medium leading-relaxed max-w-[200px] mb-8">Définissez les droits d'accès temporaires pour les projets d'équipe.</p>
            <button className="px-6 py-3 bg-cam-yellow text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl">Gérer les Permissions</button>
          </div>
          <span className="material-symbols-outlined absolute -right-8 -bottom-8 text-[12rem] opacity-10 rotate-12">account_tree</span>
        </div>
      </div>
    </div>
  );
};

export default ServiceDashboard;
