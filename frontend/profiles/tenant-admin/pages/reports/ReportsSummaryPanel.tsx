import React from 'react';
import { Link } from 'react-router-dom';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { InlineHelpButton } from '../../../../components/ui/InlineHelpButton';
import { Tooltip } from '../../../../components/ui/Tooltip';
import { UI_TOOLTIPS } from '../../../../content/uiTooltips';
import type { ReportsKpiItem, ReportsPriorityAction, ReportsSummaryStatus } from './reportsViewModel';

interface ReportsSummaryPanelProps {
  status: ReportsSummaryStatus;
  kpis: ReportsKpiItem[];
  actions: ReportsPriorityAction[];
  chart: Array<{
    label: string;
    documents_created: number;
    documents_auto_classified: number;
    documents_needing_review: number;
  }>;
  chartLabel: string;
  chartLoading?: boolean;
  chartError?: string | null;
}

const STATUS_STYLES: Record<ReportsSummaryStatus['level'], {
  border: string;
  bg: string;
  text: string;
  dot: string;
}> = {
  good: {
    border: 'border-emerald-200',
    bg: 'bg-emerald-50/70',
    text: 'text-emerald-900',
    dot: 'bg-emerald-500',
  },
  warn: {
    border: 'border-amber-200',
    bg: 'bg-amber-50/70',
    text: 'text-amber-900',
    dot: 'bg-amber-500',
  },
  bad: {
    border: 'border-red-200',
    bg: 'bg-red-50/70',
    text: 'text-red-900',
    dot: 'bg-red-500',
  },
};

const SIGNAL_TONE: Record<'warn' | 'bad' | 'neutral', string> = {
  warn: 'border-amber-200 bg-white text-amber-800',
  bad: 'border-red-200 bg-white text-red-800',
  neutral: 'border-slate-200 bg-white text-slate-700',
};

const KPI_TONE: Record<ReportsKpiItem['tone'], string> = {
  neutral: 'text-slate-900',
  good: 'text-emerald-700',
  warn: 'text-amber-700',
  info: 'text-blue-700',
};

const ACTION_TONE: Record<ReportsPriorityAction['tone'], string> = {
  bad: 'border-red-200 hover:border-red-300',
  warn: 'border-amber-200 hover:border-amber-300',
  info: 'border-blue-200 hover:border-blue-300',
};

const CHART_SERIES_LABELS: Record<'documents_created' | 'documents_auto_classified' | 'documents_needing_review', string> = {
  documents_created: 'Créations',
  documents_auto_classified: 'Classement automatique',
  documents_needing_review: 'À revoir',
};

export const ReportsSummaryPanel: React.FC<ReportsSummaryPanelProps> = ({
  status,
  kpis,
  actions,
  chart,
  chartLabel,
  chartLoading = false,
  chartError = null,
}) => {
  const statusStyle = STATUS_STYLES[status.level];

  return (
    <div className="space-y-6">
      <section
        className={`rounded-[1.5rem] border ${statusStyle.border} ${statusStyle.bg} px-5 py-4`}
        aria-label="État général"
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <span className={`inline-flex h-3 w-3 rounded-full ${statusStyle.dot}`} aria-hidden="true" />
            <p className={`text-sm font-black uppercase tracking-wider ${statusStyle.text}`}>
              {status.headline}
            </p>
          </div>

          {status.signals.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              {status.signals.map((signal) => (
                <span
                  key={signal.label}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold ${SIGNAL_TONE[signal.tone]}`}
                >
                  <span className="font-black">{signal.value}</span>
                  <span className="text-[11px] uppercase tracking-wider text-slate-500">{signal.label}</span>
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <section aria-label="Indicateurs principaux">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-500">
            Situation actuelle
          </h2>
          <InlineHelpButton
            content={UI_TOOLTIPS.reports.tabSynthese}
            label="Aide sur la synthèse"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {kpis.map((kpi) => (
            <article
              key={kpi.id}
              className="rounded-[1.5rem] border border-slate-100 bg-white px-5 py-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                  {kpi.label}
                </p>
                <div className="flex items-center gap-2">
                  {kpi.estimated ? (
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-700">
                      Estimation
                    </span>
                  ) : null}
                  <Tooltip
                    content={(
                      <span className="block max-w-[260px] whitespace-pre-line leading-relaxed">
                        {kpi.helper}
                      </span>
                    )}
                    side="bottom"
                    align="right"
                  >
                    <button
                      type="button"
                      aria-label={`Aide — ${kpi.label}`}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 transition-colors hover:border-rdpc-blue/40 hover:text-rdpc-blue"
                    >
                      <span className="material-symbols-outlined text-[16px]" aria-hidden>help</span>
                    </button>
                  </Tooltip>
                </div>
              </div>

              <p className={`mt-3 text-3xl font-black tracking-tight tabular-nums ${KPI_TONE[kpi.tone]}`}>
                {kpi.value}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                {kpi.shortHelper ?? kpi.helper}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section aria-label="Évolution récente">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-500">
            Évolution récente
          </h2>
          <span className="text-xs font-medium text-slate-400">{chartLabel}</span>
        </div>

        <div className="rounded-[1.5rem] border border-slate-100 bg-white px-5 py-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-2 text-xs font-bold text-slate-600">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-700" aria-hidden="true" />
              Créations
            </span>
            <span className="inline-flex items-center gap-2 text-xs font-bold text-slate-600">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" aria-hidden="true" />
              Classement automatique
            </span>
            <span className="inline-flex items-center gap-2 text-xs font-bold text-slate-600">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" aria-hidden="true" />
              À revoir
            </span>
          </div>

          {chartError ? (
            <div className="rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-sm font-bold text-red-600">
              {chartError}
            </div>
          ) : chartLoading ? (
            <div className="flex h-[260px] items-center justify-center">
              <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-rdpc-blue" />
            </div>
          ) : chart.length > 0 ? (
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chart} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={18}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }}
                    tickLine={false}
                    axisLine={false}
                    width={42}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      borderRadius: '16px',
                      borderColor: '#e2e8f0',
                      boxShadow: '0 12px 24px rgba(15, 23, 42, 0.08)',
                    }}
                    formatter={(value?: number | string, name?: string) => {
                      const safeName = name ?? '';
                      const seriesName = CHART_SERIES_LABELS[safeName as keyof typeof CHART_SERIES_LABELS] ?? safeName;
                      return [`${value ?? 0}`, seriesName];
                    }}
                    labelFormatter={(label: React.ReactNode) => label}
                  />
                  <Line type="monotone" dataKey="documents_created" stroke="#1d4ed8" strokeWidth={3} dot={false} />
                  <Line type="monotone" dataKey="documents_auto_classified" stroke="#059669" strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="documents_needing_review" stroke="#f59e0b" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-sm text-slate-500">
              Aucune évolution n’apparaît encore pour cette période.
            </div>
          )}
        </div>
      </section>

      <section aria-label="Points d’attention">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-500">
            Points d’attention
          </h2>
        </div>

        {actions.length === 0 ? (
          <div className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50/70 px-5 py-4">
            <p className="text-sm font-black uppercase tracking-wider text-emerald-900">
              Rien d’urgent à traiter
            </p>
            <p className="mt-1 text-sm text-emerald-800">
              Les signaux actuels ne montrent pas de point bloquant visible.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {actions.map((action) => (
              <Link
                key={action.id}
                to={action.href}
                className={`group rounded-[1.5rem] border bg-white px-5 py-4 shadow-sm transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-rdpc-blue ${ACTION_TONE[action.tone]}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-black uppercase tracking-wider text-slate-900">
                      {action.label}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">
                      {action.helper}
                    </p>
                  </div>
                  <span className="shrink-0 text-2xl font-black tabular-nums text-slate-900">
                    {action.count}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
