
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../services/api';
import { TenantMetrics } from '../../../types';
import { useAuthStore } from '../../../stores/authStore';

function exportMetricsCsv(metrics: TenantMetrics | null) {
  if (!metrics) return;
  const rows = [
    ['Categorie', 'Indicateur', 'Valeur'],
    ['Documents', 'Total', metrics.documents.total],
    ['Documents', 'Stockage (MB)', metrics.documents.storage_used_mb],
    ['Utilisateurs', 'Total', metrics.users.total],
    ['Workflows', 'Completes', metrics.workflows.completed],
    ['Workflows', 'En attente', metrics.workflows.pending],
    ['Workflows', 'Rejetes', metrics.workflows.rejected],
  ];
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `org-metrics-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const OrgDashboard: React.FC = () => {
  const navigate = useNavigate();
  const userProfile = useAuthStore((s) => s.userProfile);
  const [metrics, setMetrics] = useState<TenantMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await api.getTenantAnalytics();
        setMetrics(data);
      } catch (err) {
        console.error('Failed to fetch org dashboard data:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-700 pb-20 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tighter italic uppercase mb-1">Vue D&apos;Ensemble</h2>
          <p className="text-slate-500 text-sm font-medium">Métriques clés et activité du ministère pour la période en cours.</p>
        </div>
        <div className="flex gap-3">
           <button
             onClick={() => exportMetricsCsv(metrics)}
             disabled={!metrics}
             className="px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
           >
              <span className="material-symbols-outlined text-lg">download</span> Exporter
           </button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          icon="description"
          iconColor="text-green-600"
          iconBg="bg-green-50"
          label="Documents"
          value={isLoading ? '...' : String(metrics?.documents?.total ?? 0)}
          subtext="Total enregistrés"
        />
        <KPICard
          icon="pending_actions"
          iconColor="text-yellow-600"
          iconBg="bg-yellow-50"
          label="En Attente de Visa"
          value={isLoading ? '...' : String(metrics?.workflows?.pending ?? 0)}
          subtext={`${metrics?.workflows?.rejected ?? 0} rejetés`}
        />
        <KPICard
          icon="cloud"
          iconColor="text-blue-600"
          iconBg="bg-blue-50"
          label="Stockage Utilisé"
          value={isLoading ? '...' : `${metrics?.documents?.storage_used_mb ?? 0} MB`}
          subtext="Espace consommé"
        />
        <KPICard
          icon="group"
          iconColor="text-purple-600"
          iconBg="bg-purple-50"
          label="Utilisateurs"
          value={isLoading ? '...' : String(metrics?.users?.total ?? 0)}
          subtext="Comptes actifs"
        />
      </div>

      {!isLoading && metrics && (metrics.documents?.total ?? 0) === 0 && ((metrics.workflows?.completed ?? 0) + (metrics.workflows?.pending ?? 0) + (metrics.workflows?.rejected ?? 0)) === 0 && (
        <div className="rounded-3xl bg-gradient-to-br from-rdpc-blue/5 via-white to-emerald-50 border border-rdpc-blue/20 p-6 md:p-8">
          <div className="flex items-center gap-3 mb-2">
            <span className="material-symbols-outlined text-2xl text-rdpc-blue">waving_hand</span>
            <h3 className="text-base font-black text-slate-900 tracking-tighter italic uppercase">
              Bienvenue {userProfile?.name?.split(' ')[0] || ''}, par où commencer ?
            </h3>
          </div>
          <p className="text-xs text-slate-500 mb-6 ml-9">
            Ce ministère n'a pas encore d'activité. Voici les actions clés pour le rendre opérationnel :
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FirstStep
              num="1"
              icon="hub"
              color="text-rdpc-blue"
              title="Compléter la structure (services + N+1)"
              desc="Vérifiez que les directions, sous-directions et services sont bien créés, et que chaque utilisateur a un responsable hiérarchique."
              onClick={() => navigate('/org')}
            />
            <FirstStep
              num="2"
              icon="rule"
              color="text-violet-600"
              title="Créer les types de documents"
              desc="Définissez les natures de documents traités (Lettres, Factures, Arrêtés...) et la façon dont ils circulent."
              onClick={() => navigate('/rules')}
            />
            <FirstStep
              num="3"
              icon="upload_file"
              color="text-amber-600"
              title="Importer ou tester un document"
              desc="Validez la chaîne upload → OCR → indexation, ou démarrez un import en masse depuis un dossier."
              onClick={() => navigate('/ingestion')}
            />
            <FirstStep
              num="4"
              icon="rule_folder"
              color="text-emerald-600"
              title="Trier les documents en attente"
              desc="Affecter ou re-classer les documents que les règles n'ont pas pu traiter automatiquement."
              onClick={() => navigate('/needs-review')}
            />
            <FirstStep
              num="5"
              icon="assignment_ind"
              color="text-rose-600"
              title="Documents sans destinataire"
              desc="Boîte des documents arrivés sans assignation — à router manuellement vers le bon service."
              onClick={() => navigate('/pending-assignments')}
            />
            <FirstStep
              num="6"
              icon="history"
              color="text-slate-700"
              title="Consulter le journal d'audit"
              desc="Toutes les actions critiques sont tracées. À surveiller régulièrement pour détecter les anomalies."
              onClick={() => navigate('/audit')}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Workflow Summary */}
        <div className="lg:col-span-2 bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-base font-black text-slate-800 tracking-tighter italic uppercase">Résumé Des Workflows</h3>
              <p className="text-xs text-slate-400 font-medium mt-1">Répartition des étapes de validation.</p>
            </div>
          </div>
          {metrics ? (
            <div className="grid grid-cols-3 gap-6">
              <div className="text-center p-8 bg-green-50 rounded-3xl">
                <p className="text-5xl font-black text-green-600">{metrics.workflows.completed}</p>
                <p className="text-xs font-bold text-green-500 mt-2 uppercase tracking-widest">Complétés</p>
              </div>
              <div className="text-center p-8 bg-blue-50 rounded-3xl">
                <p className="text-5xl font-black text-blue-600">{metrics.workflows.pending}</p>
                <p className="text-xs font-bold text-blue-500 mt-2 uppercase tracking-widest">En Attente</p>
              </div>
              <div className="text-center p-8 bg-red-50 rounded-3xl">
                <p className="text-5xl font-black text-red-600">{metrics.workflows.rejected}</p>
                <p className="text-xs font-bold text-red-500 mt-2 uppercase tracking-widest">Rejetés</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[200px]">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-rdpc-blue"></div>
            </div>
          )}
        </div>

        {/* Right Column: Storage */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <span className="material-symbols-outlined text-slate-400">cloud_queue</span>
              <h3 className="text-sm font-black text-slate-800 tracking-tighter italic uppercase">Stockage Tenant</h3>
            </div>
            {(() => {
              const used = metrics?.documents?.storage_used_mb ?? 0;
              const quota = metrics?.documents?.storage_quota_mb ?? 5120;
              const pct = Math.min((used / quota) * 100, 100);
              const barColor = pct >= 90 ? 'bg-red-500' : pct >= 75 ? 'bg-yellow-400' : 'bg-[#4ade80]';
              return (
                <>
                  <div className="flex justify-between items-end mb-2">
                    <span className="text-xs font-bold text-slate-500">Utilisé</span>
                    <div className="text-right">
                      <span className="text-lg font-black text-slate-800">{used} MB</span>
                      <span className="text-xs font-medium text-slate-400"> / {quota >= 1024 ? `${(quota / 1024).toFixed(0)} GB` : `${quota} MB`}</span>
                    </div>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden mb-3">
                    <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${pct}%` }}></div>
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                    {pct.toFixed(1)}% du quota utilisé.
                  </p>
                </>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
};

const FirstStep: React.FC<{ num: string; icon: string; color: string; title: string; desc: string; onClick: () => void }> = ({ num, icon, color, title, desc, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="group flex items-start gap-3 p-4 rounded-2xl bg-white border border-slate-100 hover:border-rdpc-blue hover:shadow-md transition-all text-left"
  >
    <span className={`flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-50 ${color} font-black text-xs`}>
      {num}
    </span>
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-1.5 mb-1">
        <span className={`material-symbols-outlined text-base ${color}`}>{icon}</span>
        <p className="text-xs font-black uppercase tracking-widest text-slate-800">{title}</p>
      </div>
      <p className="text-[11px] text-slate-500 leading-relaxed">{desc}</p>
    </div>
    <span className="material-symbols-outlined text-slate-300 group-hover:text-rdpc-blue group-hover:translate-x-1 transition-all">arrow_forward</span>
  </button>
);

const KPICard = ({ icon, iconColor, iconBg, label, value, subtext }: any) => (
  <div className="bg-white p-6 rounded-[1.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all">
    <div className="flex justify-between items-start mb-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBg} ${iconColor}`}>
        <span className="material-symbols-outlined text-xl">{icon}</span>
      </div>
    </div>
    <p className="text-[11px] font-bold text-slate-500">{label}</p>
    <h4 className="text-2xl font-black text-slate-900 mt-1 mb-1 tracking-tight">{value}</h4>
    <p className="text-[10px] font-medium text-slate-400">{subtext}</p>
  </div>
);

export default OrgDashboard;
