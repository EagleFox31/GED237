
import React, { useEffect, useState } from 'react';

import { api } from '../services/api';
import { TenantMetrics } from '../types';

const Dashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<TenantMetrics | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [metricsData, notifData] = await Promise.allSettled([
          api.getTenantAnalytics(),
          api.getNotifications(),
        ]);
        if (metricsData.status === 'fulfilled') setMetrics(metricsData.value);
        if (notifData.status === 'fulfilled') setNotifications(notifData.value?.slice?.(0, 5) || []);
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-700">
      <div className="flex items-end justify-between">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-rdpc-blue/5 text-rdpc-blue rounded-full text-[9px] font-black uppercase tracking-[0.2em] mb-3 border border-rdpc-blue/10">
            <span className="w-1.5 h-1.5 rounded-full bg-rdpc-blue animate-pulse"></span>
            Mode Sécurisé Actif
          </div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter italic uppercase">Contrôle <span className="text-rdpc-blue">Central</span></h2>
          <p className="text-slate-500 mt-1 font-medium italic">Tableau de bord de conformité et traçabilité documentaire.</p>
        </div>
        <div className="flex gap-4">
          <button className="px-6 py-3 bg-white border-2 border-slate-50 rounded-2xl text-[11px] font-black uppercase tracking-widest text-slate-500 hover:border-slate-100 transition-all flex items-center gap-3">
            <span className="material-symbols-outlined text-lg">history_edu</span>
            Journal d'Audit
          </button>
          <button className="px-8 py-3 bg-rdpc-blue text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-2xl shadow-blue-500/20 hover:bg-blue-800 transition-all flex items-center gap-3 italic">
            <span className="material-symbols-outlined text-lg">quick_reference_all</span>
            Rapport Hebdomadaire
          </button>
        </div>
      </div>

      {/* Stats Cards - From API */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Utilisateurs', value: isLoading ? '...' : metrics?.users?.total ?? 0, trend: 'Actifs', color: 'blue', icon: 'group' },
          { label: 'Documents', value: isLoading ? '...' : metrics?.documents?.total ?? 0, trend: 'Enregistrés', color: 'slate', icon: 'description' },
          { label: 'Stockage Utilisé', value: isLoading ? '...' : `${metrics?.documents?.storage_used_mb ?? 0} MB`, trend: 'Sur Quota', color: 'green', icon: 'cloud' },
          { label: 'Visa en Attente', value: isLoading ? '...' : metrics?.workflows?.pending ?? 0, trend: (metrics?.workflows?.rejected ?? 0) > 0 ? `${metrics!.workflows.rejected} rejetés` : 'À Jour', color: (metrics?.workflows?.rejected ?? 0) > 0 ? 'red' : 'green', icon: 'draw' },
        ].map((stat, i) => (
          <div key={i} className="glass p-6 rounded-[2.5rem] hover:shadow-2xl transition-all border border-white group cursor-pointer overflow-hidden relative bg-white/40">
            <div className="flex justify-between items-start">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
              <span className={`material-symbols-outlined text-${stat.color === 'blue' ? 'rdpc-blue' : stat.color === 'red' ? 'red-500' : stat.color === 'green' ? 'green-600' : 'slate-500'} opacity-30`}>{stat.icon}</span>
            </div>
            <div className="flex items-end justify-between mt-5">
              <h3 className="text-4xl font-black text-slate-900 tracking-tighter italic">{stat.value}</h3>
              <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg ${stat.color === 'red' ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-600'}`}>
                {stat.trend}
              </span>
            </div>
            <div className={`absolute bottom-0 left-0 h-1 bg-${stat.color === 'blue' ? 'rdpc-blue' : stat.color === 'red' ? 'red-500' : stat.color === 'green' ? 'green-600' : 'slate-500'} w-0 group-hover:w-full transition-all duration-500`}></div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 glass p-10 rounded-[3rem] border-white relative overflow-hidden bg-white/60">
          <div className="flex items-center justify-between mb-10 relative z-10">
            <div>
              <h3 className="text-xl font-black text-slate-800 tracking-tighter uppercase italic">Activité Documentaire</h3>
              <p className="text-xs text-slate-400 font-medium mt-1">Résumé des métriques du tenant.</p>
            </div>
          </div>
          <div className="h-[320px] relative z-10">
            {metrics ? (
              <div className="grid grid-cols-3 gap-6 h-full items-center">
                <div className="text-center p-6 bg-green-50 rounded-3xl">
                  <p className="text-5xl font-black text-green-600">{metrics.workflows.completed}</p>
                  <p className="text-xs font-bold text-green-500 mt-2 uppercase tracking-widest">Validés</p>
                </div>
                <div className="text-center p-6 bg-blue-50 rounded-3xl">
                  <p className="text-5xl font-black text-blue-600">{metrics.workflows.pending}</p>
                  <p className="text-xs font-bold text-blue-500 mt-2 uppercase tracking-widest">En Attente</p>
                </div>
                <div className="text-center p-6 bg-red-50 rounded-3xl">
                  <p className="text-5xl font-black text-red-600">{metrics.workflows.rejected}</p>
                  <p className="text-xs font-bold text-red-500 mt-2 uppercase tracking-widest">Rejetés</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-rdpc-blue"></div>
              </div>
            )}
          </div>
        </div>

        <div className="glass p-10 rounded-[3rem] border-white flex flex-col bg-white/60">
          <h3 className="text-xl font-black text-slate-800 mb-8 tracking-tighter uppercase italic">Notifications</h3>
          <div className="space-y-6 flex-1 overflow-y-auto pr-2 scrollbar-hide">
            {notifications.length === 0 && !isLoading && (
              <p className="text-sm text-slate-400 font-medium italic text-center py-8">Aucune notification récente.</p>
            )}
            {notifications.map((notif: any, i: number) => (
              <div key={notif.id || i} className="flex gap-5 items-start group cursor-pointer hover:bg-slate-50/50 p-2 rounded-2xl transition-all">
                <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center shrink-0 border border-slate-100 shadow-sm group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-rdpc-blue opacity-40 text-2xl font-bold">
                    {notif.type === 'WORKFLOW_ASSIGNED' ? 'assignment' : notif.type === 'WORKFLOW_COMPLETED' ? 'task_alt' : 'notifications'}
                  </span>
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-xs text-slate-700 font-black leading-tight group-hover:text-rdpc-blue transition-colors">
                    {notif.message || notif.title || 'Notification'}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                      {notif.created_at ? new Date(notif.created_at).toLocaleDateString('fr-CM') : ''}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button className="w-full mt-10 py-4 bg-slate-50 hover:bg-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 transition-all">Toutes les Notifications</button>
        </div>
      </div>

      {/* Policy Accents */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="rounded-[3rem] p-10 bg-rdpc-blue text-white shadow-2xl relative overflow-hidden group">
          <div className="relative z-10 flex flex-col h-full justify-between">
            <div>
              <h3 className="text-3xl font-black italic tracking-tighter uppercase leading-[0.8] mb-4">Souveraineté <br /><span className="text-cam-yellow">Numérique</span></h3>
              <p className="opacity-70 max-w-xs text-sm font-medium leading-relaxed">Les données sont hébergées au Cameroun selon les directives nationales de cyber-résilience.</p>
            </div>
            <button className="mt-8 px-8 py-4 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all border border-white/20 w-fit">Vérifier l'Hébergement</button>
          </div>
          <span className="material-symbols-outlined absolute -right-10 -bottom-10 text-[12rem] opacity-5 transform rotate-12 group-hover:rotate-0 transition-transform duration-1000">security</span>
        </div>

        <div className="rounded-[3rem] p-10 bg-white border border-slate-100 text-slate-900 shadow-xl relative overflow-hidden group">
          <div className="relative z-10 flex flex-col h-full justify-between">
            <div>
              <h3 className="text-3xl font-black italic tracking-tighter uppercase leading-[0.8] mb-4 text-rdpc-blue">Zéro <br />Papier <span className="text-green-600">2026</span></h3>
              <p className="text-slate-500 max-w-xs text-sm font-medium leading-relaxed">La transformation numérique avance. 100% des flux RH sont désormais dématérialisés.</p>
            </div>
            <button className="mt-8 px-8 py-4 bg-slate-50 hover:bg-slate-100 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all border border-slate-100 w-fit text-slate-600">Statistiques Écologiques</button>
          </div>
          <span className="material-symbols-outlined absolute -right-10 -bottom-10 text-[12rem] text-green-600 opacity-5 transform rotate-12 group-hover:rotate-0 transition-transform duration-1000">nature_people</span>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
