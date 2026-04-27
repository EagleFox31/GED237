
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icons } from '../../../constants';
import { api } from '../../../services/api';
import { PlatformMetrics } from '../../../types';

const PlatformDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const data = await api.getPlatformAnalytics();
        setMetrics(data);
      } catch (error) {
        console.error("Failed to fetch platform analytics:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchMetrics();
  }, []);

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-700">
      <div className="flex items-end justify-between">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-cam-red/5 text-cam-red rounded-full text-[9px] font-black uppercase tracking-[0.2em] mb-3 border border-cam-red/10">
            <span className="w-1.5 h-1.5 rounded-full bg-cam-red animate-pulse"></span>
            Contrôle Global Plateforme
          </div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter italic uppercase">Super <span className="text-cam-red">Admin</span></h2>
          <p className="text-slate-500 mt-1 font-medium italic">Gestion des instances gouvernementales et sécurité système.</p>
        </div>
      </div>

      {/* Global Platforms Metrics — cliquables */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Instances Actives', value: isLoading ? '...' : metrics?.tenants?.total ?? 0, icon: 'account_balance', to: '/tenants', cta: 'Gérer les institutions' },
          { label: 'Utilisateurs Réseau', value: isLoading ? '...' : metrics?.users?.total ?? 0, icon: 'manage_accounts', to: '/platform-users', cta: 'Voir les utilisateurs' },
          { label: 'Documents Sécurisés', value: isLoading ? '...' : metrics?.platform?.total_documents ?? 0, icon: 'admin_panel_settings', to: '/documents', cta: 'Explorer les documents' },
          { label: 'Stockage Global', value: isLoading ? '...' : `${metrics?.platform?.total_storage_gb ?? 0} GB`, icon: 'cloud', to: '/audit', cta: 'Consulter l\'audit' },
        ].map((stat, i) => (
          <button
            key={i}
            type="button"
            onClick={() => navigate(stat.to)}
            className="glass p-6 rounded-[2.5rem] bg-white/40 border border-white hover:shadow-2xl hover:bg-white/70 hover:-translate-y-0.5 transition-all group overflow-hidden relative text-left focus:outline-none focus:ring-2 focus:ring-rdpc-blue/40"
          >
            <div className="flex justify-between items-start">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
              <span className="material-symbols-outlined text-slate-400 opacity-30 group-hover:opacity-80 group-hover:text-rdpc-blue transition-all">{stat.icon}</span>
            </div>
            <div className="mt-5">
              <h3 className="text-4xl font-black text-slate-900 tracking-tighter italic">{stat.value}</h3>
            </div>
            <div className="mt-4 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-rdpc-blue opacity-70 group-hover:opacity-100 transition-opacity">
              {stat.cta}
              <span className="material-symbols-outlined text-sm group-hover:translate-x-1 transition-transform">arrow_forward</span>
            </div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 glass p-8 rounded-[2.5rem] bg-white/40 border-white">
          <h3 className="text-lg font-black text-slate-800 uppercase italic mb-6">État des Institutions</h3>
          <div className="space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rdpc-blue"></div>
              </div>
            ) : (metrics?.tenants?.total ?? 0) === 0 ? (
              <p className="text-sm text-slate-400 font-medium italic text-center py-8">Aucune institution configurée.</p>
            ) : (
              <div className="text-center p-8 bg-blue-50 rounded-3xl">
                <p className="text-6xl font-black text-blue-600">{metrics?.tenants?.total}</p>
                <p className="text-sm font-bold text-blue-500 mt-2 uppercase tracking-widest">Institutions Actives</p>
                <div className="flex items-center justify-center gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => navigate('/tenants')}
                    className="px-5 py-2.5 rounded-xl bg-rdpc-blue text-white text-[10px] font-black uppercase tracking-widest hover:bg-blue-800 transition-all flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-sm">list</span>
                    Voir la liste
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/tenants?new=1')}
                    className="px-5 py-2.5 rounded-xl bg-white text-rdpc-blue border-2 border-rdpc-blue text-[10px] font-black uppercase tracking-widest hover:bg-blue-50 transition-all flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-sm">add</span>
                    Nouvelle institution
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="glass p-8 rounded-[2.5rem] bg-rdpc-blue text-white overflow-hidden relative">
          <div className="relative z-10">
            <h3 className="text-xl font-black italic uppercase tracking-tighter mb-8">Modules Activés</h3>
            <div className="space-y-6">
              {['Moteur GED Core', 'Signature Électronique', 'IA OCR Intelligence', 'Workflows Avancés'].map((mod, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-cam-yellow">check_circle</span>
                  <span className="text-xs font-bold uppercase tracking-widest">{mod}</span>
                </div>
              ))}
            </div>
          </div>
          <Icons.Flame className="absolute -right-10 -bottom-10 w-48 h-48 opacity-10" />
        </div>
      </div>
    </div>
  );
};

export default PlatformDashboard;
