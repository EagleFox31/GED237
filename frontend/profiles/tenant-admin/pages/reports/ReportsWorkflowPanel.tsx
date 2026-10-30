import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { ReportsWorkflowActivityResponse } from '../../../../services/resources/reports.api';
import type { ReportsKpiItem } from './reportsViewModel';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ReportsWorkflowPanelProps {
  kpis: ReportsKpiItem[];
  activity: ReportsWorkflowActivityResponse | null;
  loading?: boolean;
  error?: string | null;
}

type WorkflowKpiId =
  | 'workflow-open'
  | 'workflow-active-steps'
  | 'workflow-blocked-estimated'
  | 'workflow-rejected';

// ─── Constantes ──────────────────────────────────────────────────────────────

const KPI_TONE: Record<ReportsKpiItem['tone'], { value: string; icon: string; iconBg: string }> = {
  neutral: { value: 'text-slate-900', icon: 'monitoring', iconBg: 'bg-slate-100 text-slate-700' },
  good: { value: 'text-emerald-700', icon: 'task_alt', iconBg: 'bg-emerald-50 text-emerald-600' },
  warn: { value: 'text-amber-700', icon: 'warning', iconBg: 'bg-amber-50 text-amber-600' },
  info: { value: 'text-blue-700', icon: 'insights', iconBg: 'bg-blue-50 text-blue-600' },
};

// ─── Sous-composants internes ─────────────────────────────────────────────────

const renderCountBars = (
  items: Array<{ key: string; label: string; value: number }>,
  empty: string,
  color = '#2563eb',
) => {
  if (items.length === 0) {
    return (
      <p className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
        {empty}
      </p>
    );
  }

  const chartHeight = Math.max(items.length * 52, 180);

  return (
    <div className="rounded-[1.5rem] border border-slate-100 bg-slate-50/60 px-4 py-4">
      <div style={{ height: chartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={items}
            layout="vertical"
            margin={{ top: 4, right: 28, left: 16, bottom: 4 }}
            barCategoryGap={14}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
            <XAxis
              type="number"
              allowDecimals={false}
              tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              type="category"
              dataKey="label"
              width={170}
              tick={{ fill: '#0f172a', fontSize: 12, fontWeight: 700 }}
              tickLine={false}
              axisLine={false}
            />
            <RechartsTooltip
              cursor={{ fill: '#eff6ff' }}
              contentStyle={{
                borderRadius: '16px',
                borderColor: '#e2e8f0',
                boxShadow: '0 12px 24px rgba(15, 23, 42, 0.08)',
              }}
              formatter={(value) => [`${value ?? 0}`, 'Documents']}
            />
            <Bar dataKey="value" fill={color} radius={[0, 10, 10, 0]} maxBarSize={28}>
              <LabelList
                dataKey="value"
                position="right"
                className="fill-slate-900 text-xs font-black"
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const renderDelayBars = (
  items: Array<{ key: string; label: string; average_days: number; steps_count: number }>,
  empty: string,
) => {
  if (items.length === 0) {
    return (
      <p className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
        {empty}
      </p>
    );
  }

  const chartHeight = Math.max(items.length * 58, 200);

  return (
    <div className="rounded-[1.5rem] border border-slate-100 bg-slate-50/60 px-4 py-4">
      <div style={{ height: chartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={items}
            layout="vertical"
            margin={{ top: 4, right: 34, left: 16, bottom: 4 }}
            barCategoryGap={16}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `${value} j`}
            />
            <YAxis
              type="category"
              dataKey="label"
              width={170}
              tick={{ fill: '#0f172a', fontSize: 12, fontWeight: 700 }}
              tickLine={false}
              axisLine={false}
            />
            <RechartsTooltip
              cursor={{ fill: '#fff7ed' }}
              contentStyle={{
                borderRadius: '16px',
                borderColor: '#fed7aa',
                boxShadow: '0 12px 24px rgba(15, 23, 42, 0.08)',
              }}
              formatter={(value, _name, entry) => {
                const point = entry?.payload as { steps_count?: number } | undefined;
                const days = typeof value === 'number' ? value.toFixed(1) : value ?? 0;
                const count = point?.steps_count ?? 0;
                return [`${days} jour(s)`, `${count} étape(s) terminée(s)`];
              }}
            />
            <Bar dataKey="average_days" fill="#f59e0b" radius={[0, 10, 10, 0]} maxBarSize={28}>
              <LabelList
                dataKey="average_days"
                position="right"
                formatter={(value) => `${value ?? 0} j`}
                className="fill-amber-700 text-xs font-black"
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {items.map((item) => (
          <div
            key={`${item.key}-meta`}
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2"
          >
            <p className="text-xs font-black text-slate-800">{item.label}</p>
            <p className="mt-1 text-xs text-slate-500">
              {item.steps_count} étape(s) terminée(s) observée(s)
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

interface WorkflowKpiDrawerProps {
  item: ReportsKpiItem;
  activity: ReportsWorkflowActivityResponse | null;
  onClose: () => void;
}

const WorkflowKpiDrawer: React.FC<WorkflowKpiDrawerProps> = ({ item, activity, onClose }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const content = (() => {
    if (item.id === 'workflow-open') {
      return {
        title: 'Documents en traitement',
        helper: 'Cette vue montre où se trouvent les documents encore en cours de traitement.',
        body: activity?.availability.by_step
          ? renderCountBars(
              activity.by_step ?? [],
              'Aucun document en traitement n’est remonté pour cette période.',
              '#2563eb',
            )
          : (
              <p className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                La répartition par étape n’est pas encore disponible.
              </p>
            ),
      };
    }

    if (item.id === 'workflow-active-steps') {
      return {
        title: 'Actions en attente',
        helper: 'Cette vue montre ce qui est encore attendu sur les documents : validation, signature ou affectation.',
        body: activity?.availability.pending_actions
          ? renderCountBars(
              activity.pending_actions ?? [],
              'Aucune action en attente n’est disponible pour cette période.',
              '#7c3aed',
            )
          : (
              <p className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                Le détail des actions attendues n’est pas encore disponible.
              </p>
            ),
      };
    }

    if (item.id === 'workflow-blocked-estimated') {
      return {
        title: 'Documents sans avancée',
        helper: 'Cette lecture estime les documents sans avancée visible depuis plus de cinq jours.',
        body: (
          <div className="space-y-5">
            <div className="rounded-[1.5rem] border border-amber-200 bg-amber-50/70 px-5 py-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">Estimation actuelle</p>
              <p className="mt-2 text-4xl font-black tracking-tighter text-slate-900">
                {activity?.blocked_workflows_estimated ?? 0}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Document(s) sans avancée depuis plus de cinq jours.
              </p>
            </div>
            <div>
              <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                Étapes les plus lentes
              </p>
              {renderDelayBars(
                activity?.slowest_steps ?? [],
                'Aucune lenteur moyenne n’est encore disponible.',
              )}
            </div>
          </div>
        ),
      };
    }

    return {
      title: 'Documents refusés ou retournés',
      helper: 'Cette vue met en évidence les documents revenus pour correction, refusés ou annulés.',
      body: (
        <div className="space-y-5">
          <div className="rounded-[1.5rem] border border-red-200 bg-red-50/70 px-5 py-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-red-700">Volume actuel</p>
            <p className="mt-2 text-4xl font-black tracking-tighter text-slate-900">
              {activity?.rejected_steps ?? 0}
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Document(s) revenus pour correction, refusés ou annulés pendant le traitement.
            </p>
          </div>
          <Link
            to="/tasks"
            className="inline-flex items-center gap-2 text-sm font-bold text-rdpc-blue underline decoration-blue-200 underline-offset-2 hover:decoration-rdpc-blue"
          >
            Voir les documents concernés
            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">arrow_forward</span>
          </Link>
        </div>
      ),
    };
  })();

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="reports-workflow-drawer-title"
        className="relative h-full w-full max-w-md overflow-y-auto bg-white shadow-2xl animate-in slide-in-from-right duration-300"
      >
        <header className="sticky top-0 z-10 flex items-start gap-3 border-b border-slate-100 bg-white px-6 py-5">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-rdpc-blue/10 text-rdpc-blue">
            <span className="material-symbols-outlined">monitoring</span>
          </div>
          <div className="min-w-0 flex-1">
            <h3 id="reports-workflow-drawer-title" className="truncate text-xl font-black uppercase italic tracking-tighter text-slate-900">
              {content.title}
            </h3>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              {content.helper}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="-mt-1 text-slate-400 hover:text-slate-700"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>

        <div className="space-y-5 px-6 py-5">
          {content.body}
        </div>
      </aside>
    </div>
  );
};

interface AlertCardProps {
  label: string;
  count: number;
  description: string;
  actionLabel: string;
  actionHref: string;
  tone: 'warn' | 'bad';
}

const ALERT_STYLES = {
  warn: {
    border: 'border-amber-200',
    bg: 'bg-amber-50/60',
    countColor: 'text-amber-700',
    dotColor: 'bg-amber-400',
  },
  bad: {
    border: 'border-red-200',
    bg: 'bg-red-50/60',
    countColor: 'text-red-700',
    dotColor: 'bg-red-400',
  },
};

const AlertCard: React.FC<AlertCardProps> = ({
  label,
  count,
  description,
  actionLabel,
  actionHref,
  tone,
}) => {
  const styles = ALERT_STYLES[tone];
  return (
    <Link
      to={actionHref}
      className={`group flex items-center gap-4 rounded-[1.5rem] border ${styles.border} ${styles.bg} px-5 py-4 transition-colors hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-rdpc-blue`}
    >
      <span className={`inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white text-2xl font-black tabular-nums shadow-sm ${styles.countColor}`}>
        {count}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-black uppercase tracking-wider text-slate-900">{label}</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-600">{description}</p>
        <p className="mt-2 text-xs font-bold text-rdpc-blue">
          {actionLabel}
          <span className="ml-1 transition-transform group-hover:translate-x-0.5 inline-block">→</span>
        </p>
      </div>
    </Link>
  );
};

// ─── Composant principal ──────────────────────────────────────────────────────

export const ReportsWorkflowPanel: React.FC<ReportsWorkflowPanelProps> = ({
  kpis,
  activity,
  loading = false,
  error = null,
}) => {
  const [selectedKpiId, setSelectedKpiId] = useState<WorkflowKpiId | null>(null);
  const selectedKpi = useMemo(
    () => kpis.find((kpi) => kpi.id === selectedKpiId) ?? null,
    [kpis, selectedKpiId],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-14">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-rdpc-blue" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-[1.5rem] border border-red-100 bg-red-50 px-6 py-5 text-sm font-bold text-red-600">
        {error}
      </div>
    );
  }

  const blockedCount = activity?.blocked_workflows_estimated ?? 0;
  const rejectedCount = activity?.rejected_steps ?? 0;
  const hasAlerts = blockedCount > 0 || rejectedCount > 0;
  const hasByStep = (activity?.by_step?.length ?? 0) > 0;
  const hasPendingActions = (activity?.pending_actions?.length ?? 0) > 0;
  const hasSlowestSteps = (activity?.slowest_steps?.length ?? 0) > 0;

  return (
    <>
    <div className="space-y-6">

      {/* 1. Indicateurs ─────────────────────────────────────────────────── */}
      <section aria-label="Situation actuelle du traitement">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-500">
            Situation actuelle
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map((kpi) => (
            <button
              key={kpi.id}
              type="button"
              onClick={() => setSelectedKpiId(kpi.id as WorkflowKpiId)}
              className="rounded-[1.5rem] border border-slate-100 bg-white px-5 py-4 shadow-sm text-left transition-colors hover:border-rdpc-blue/30 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-rdpc-blue"
            >
              <div className="flex items-start justify-between gap-3">
                <div className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl ${KPI_TONE[kpi.tone].iconBg}`}>
                  <span className="material-symbols-outlined text-[20px]" aria-hidden="true">{KPI_TONE[kpi.tone].icon}</span>
                </div>
                <div className="flex items-center gap-2">
                  {kpi.estimated && (
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-700">
                      Estimation
                    </span>
                  )}
                  <span className="material-symbols-outlined text-slate-300" aria-hidden="true">chevron_right</span>
                </div>
              </div>
              <p className="mt-4 text-[11px] font-black uppercase tracking-widest text-slate-500">
                  {kpi.label}
              </p>
              <p className={`mt-2 text-3xl font-black tracking-tight tabular-nums ${KPI_TONE[kpi.tone].value}`}>
                {kpi.value}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                {kpi.shortHelper ?? kpi.helper}
              </p>
            </button>
          ))}
        </div>
      </section>

      {/* 2. Répartition visible ─────────────────────────────────────────── */}
      <section aria-label="Répartition du traitement">
        <h2 className="mb-3 text-[11px] font-black uppercase tracking-widest text-slate-500">
          Répartition du traitement
        </h2>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="rounded-[1.5rem] border border-slate-100 bg-white px-5 py-5 shadow-sm">
            <p className="mb-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
              Documents en traitement
            </p>
            {hasByStep ? (
              renderCountBars(
                activity?.by_step ?? [],
                'Aucun document en traitement n’est remonté pour cette période.',
                '#2563eb',
              )
            ) : (
              <p className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                Aucune répartition par étape n’est encore disponible pour cette période.
              </p>
            )}
          </div>

          <div className="rounded-[1.5rem] border border-slate-100 bg-white px-5 py-5 shadow-sm">
            <p className="mb-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
              Actions en attente
            </p>
            {hasPendingActions ? (
              renderCountBars(
                activity?.pending_actions ?? [],
                'Aucune action en attente n’est disponible pour cette période.',
                '#7c3aed',
              )
            ) : (
              <p className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                Aucune ventilation des validations, signatures ou affectations n’est encore disponible.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* 3. Délais ──────────────────────────────────────────────────────── */}
      {hasSlowestSteps ? (
        <section aria-label="Étapes de traitement les plus lentes">
          <h2 className="mb-3 text-[11px] font-black uppercase tracking-widest text-slate-500">
            Lenteurs visibles
          </h2>
          <div className="rounded-[1.5rem] border border-slate-100 bg-white px-5 py-5 shadow-sm">
            <p className="mb-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
              Étapes les plus lentes — délai moyen
            </p>
            {renderDelayBars(
              activity?.slowest_steps ?? [],
              'Aucun délai moyen par étape disponible.',
            )}
          </div>
        </section>
      ) : null}

      {/* 4. Alertes ─────────────────────────────────────────────────────── */}
      <section aria-label="Points d’attention sur le traitement">
        <h2 className="mb-3 text-[11px] font-black uppercase tracking-widest text-slate-500">
          Points d’attention
        </h2>

        {!hasAlerts ? (
          <div className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50/70 px-5 py-4">
            <p className="text-sm font-black uppercase tracking-wider text-emerald-900">
              Aucun blocage détecté
            </p>
            <p className="mt-1 text-sm text-emerald-800">
              Les circuits actifs n'affichent pas de retard ou de rejet visible.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {blockedCount > 0 && (
              <AlertCard
                label="Documents sans avancée"
                count={blockedCount}
                description="Documents sans avancée visible depuis plus de 5 jours. À confirmer avec les responsables."
                actionLabel="Voir les documents concernés"
                actionHref="/tasks"
                tone="warn"
              />
            )}
            {rejectedCount > 0 && (
              <AlertCard
                label="Documents refusés ou retournés"
                count={rejectedCount}
                description="Documents revenus pour correction, refusés ou annulés. Vérifier les causes avant relance."
                actionLabel="Voir les documents concernés"
                actionHref="/tasks"
                tone="bad"
              />
            )}
          </div>
        )}
      </section>
    </div>
    {selectedKpi ? (
      <WorkflowKpiDrawer
        item={selectedKpi}
        activity={activity}
        onClose={() => setSelectedKpiId(null)}
      />
    ) : null}
    </>
  );
};
