import React from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Tooltip } from '../../../../components/ui/Tooltip';
import { UI_TOOLTIPS } from '../../../../content/uiTooltips';
import type { ReportsSeriesKey } from '../../../../services/resources/reports.api';
import type { ReportsEvolutionGranularity } from './useReportsEvolution';

const GRANULARITY_OPTIONS: Array<{ value: ReportsEvolutionGranularity; label: string }> = [
  { value: 'day', label: 'Jours' },
  { value: 'week', label: 'Semaines' },
  { value: 'month', label: 'Mois' },
];

const SERIES_OPTIONS: Array<{ value: ReportsSeriesKey; label: string }> = [
  { value: 'documents_created', label: 'Créations' },
  { value: 'documents_auto_classified', label: 'Classement automatique' },
  { value: 'documents_needing_review', label: 'À revoir' },
];

interface ReportsTimeseriesPanelProps {
  granularity: ReportsEvolutionGranularity;
  onGranularityChange: (value: ReportsEvolutionGranularity) => void;
  selectedSeries: ReportsSeriesKey;
  onSeriesChange: (value: ReportsSeriesKey) => void;
  onRefresh: () => void;
  loading?: boolean;
  error?: string | null;
  points: Array<{ label: string; value: number }>;
  totalValue: number;
  strongestBucketLabel: string | null;
  strongestBucketValue: number;
  topUnits: Array<{ id?: string | null; label: string; value: number }>;
  periodLabel: string;
  title: string;
  helper: string;
  totalLabel: string;
  topUnitsLabel: string;
}

export const ReportsTimeseriesPanel: React.FC<ReportsTimeseriesPanelProps> = ({
  granularity,
  onGranularityChange,
  selectedSeries,
  onSeriesChange,
  onRefresh,
  loading = false,
  error = null,
  points,
  totalValue,
  strongestBucketLabel,
  strongestBucketValue,
  topUnits,
  periodLabel,
  title,
  helper,
  totalLabel,
  topUnitsLabel,
}) => {
  const hasData = points.length > 0;

  return (
    <div className="overflow-hidden rounded-[2rem] border border-slate-100 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-8 py-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Évolution
            </p>
            <h3 className="mt-2 text-2xl font-black uppercase italic tracking-tighter text-slate-900">
              {title}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              {helper}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2 py-1">
              {SERIES_OPTIONS.map((option) => {
                const active = option.value === selectedSeries;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => onSeriesChange(option.value)}
                    className={`rounded-full px-3 py-2 text-xs font-black uppercase tracking-widest transition-colors ${
                      active ? 'bg-rdpc-blue text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2 py-1">
              {GRANULARITY_OPTIONS.map((option) => {
                const active = option.value === granularity;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => onGranularityChange(option.value)}
                    className={`rounded-full px-3 py-2 text-xs font-black uppercase tracking-widest transition-colors ${
                      active ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            <Tooltip content={UI_TOOLTIPS.reports.refresh}>
              <button
                type="button"
                onClick={onRefresh}
                disabled={loading}
                aria-label="Actualiser la courbe"
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-60"
              >
                <span className={`material-symbols-outlined text-[20px] ${loading ? 'animate-spin' : ''}`}>refresh</span>
              </button>
            </Tooltip>
          </div>
        </div>
      </div>

      {error ? (
        <div className="px-8 py-10">
          <div className="rounded-[1.5rem] border border-red-100 bg-red-50 px-6 py-5 text-sm font-bold text-red-600">
            {error}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 px-8 py-8 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
          <div className="rounded-[1.75rem] border border-slate-100 bg-slate-50/70 p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Période
                </p>
                <p className="mt-2 text-base font-bold text-slate-900">{periodLabel}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {totalLabel}
                </p>
                <p className="mt-2 text-2xl font-black tracking-tighter text-slate-900">
                  {totalValue}
                </p>
              </div>
            </div>

            {loading ? (
              <div className="flex h-[320px] items-center justify-center">
                <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-rdpc-blue" />
              </div>
            ) : hasData ? (
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={points} margin={{ top: 12, right: 12, left: -12, bottom: 0 }}>
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
                      formatter={(value: number | string | undefined) => [`${value ?? 0}`, totalLabel]}
                      labelFormatter={(label: React.ReactNode) => label}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#1d4ed8"
                      strokeWidth={3}
                      dot={{ r: 4, fill: '#1d4ed8' }}
                      activeDot={{ r: 6, fill: '#0f172a' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-[320px] items-center justify-center rounded-[1.5rem] border border-dashed border-slate-200 bg-white px-6 text-center text-sm font-medium text-slate-500">
                Aucune donnée n apparaît encore pour cette lecture sur la période sélectionnée.
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="rounded-[1.75rem] border border-slate-100 bg-white p-5">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Pic d’activité
              </p>
              <p className="mt-3 text-lg font-black uppercase italic tracking-tight text-slate-900">
                {strongestBucketLabel ?? 'Aucun pic détecté'}
              </p>
              <p className="mt-2 text-4xl font-black tracking-tighter text-slate-900">
                {strongestBucketValue}
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                Période la plus chargée sur l’intervalle actuellement affiché.
              </p>
            </div>

            <div className="rounded-[1.75rem] border border-slate-100 bg-white p-5">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                {topUnitsLabel}
              </p>
              <div className="mt-4 space-y-3">
                {topUnits.length > 0 ? (
                  topUnits.map((unit) => (
                    <div
                      key={unit.id ?? unit.label}
                      className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-bold text-slate-900">{unit.label}</p>
                        <p className="text-xs text-slate-500">{totalLabel} sur la période</p>
                      </div>
                      <span className="text-lg font-black tracking-tight text-slate-900">{unit.value}</span>
                    </div>
                  ))
                ) : (
                  <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                    Aucune unité n’est encore remontée pour cette période.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
