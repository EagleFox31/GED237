// frontend/profiles/tenant-admin/pages/reports/ReportsDocumentPanel.tsx
//
// Onglet "Activité documentaire" — question : quels documents circulent ?
//
// Structure :
//   1. Indicateurs   — 4 KPI instantanés (volumes et signaux clés)
//   2. Évolution     — courbe principale (une série, granularité au choix)
//   3. Répartitions  — 2 graphes secondaires (statut + types de fichiers)
//   4. Signaux       — 4 cartes actionnables (vigilance documentaire)
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

import { Tooltip } from '../../../../components/ui/Tooltip';
import type { ReportsDocumentActivityResponse, ReportsSeriesKey } from '../../../../services/resources/reports.api';
import type { ReportsKpiItem } from './reportsViewModel';
import type { ReportsEvolutionGranularity } from './useReportsEvolution';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ReportsDocumentPanelProps {
  kpis: ReportsKpiItem[];
  // Évolution
  granularity: ReportsEvolutionGranularity;
  onGranularityChange: (g: ReportsEvolutionGranularity) => void;
  selectedSeries: ReportsSeriesKey;
  onSeriesChange: (s: ReportsSeriesKey) => void;
  onRefresh: () => void;
  points: Array<{ label: string; value: number }>;
  totalValue: number;
  topUnits: Array<{ id?: string | null; label: string; value: number }>;
  periodLabel: string;
  totalLabel: string;
  topUnitsLabel: string;
  timeseriesLoading?: boolean;
  timeseriesError?: string | null;
  // Répartitions + signaux
  activity: ReportsDocumentActivityResponse | null;
  activityLoading?: boolean;
  activityError?: string | null;
}

// ─── Constantes ──────────────────────────────────────────────────────────────

const GRANULARITY_OPTIONS: Array<{ value: ReportsEvolutionGranularity; label: string }> = [
  { value: 'day', label: 'Jours' },
  { value: 'week', label: 'Semaines' },
  { value: 'month', label: 'Mois' },
];

const SERIES_OPTIONS: Array<{ value: ReportsSeriesKey; label: string }> = [
  { value: 'documents_created', label: 'Créations' },
  { value: 'documents_auto_classified', label: 'Classement auto' },
  { value: 'documents_needing_review', label: 'À revoir' },
];

const KPI_TONE: Record<ReportsKpiItem['tone'], string> = {
  neutral: 'text-slate-900',
  good: 'text-emerald-700',
  warn: 'text-amber-700',
  info: 'text-blue-700',
};

// ─── Sous-composants internes ─────────────────────────────────────────────────

const renderBars = (
  items: Array<{ key: string; label: string; value: number }>,
  empty: string,
) => {
  const maxValue = items.reduce((acc, item) => Math.max(acc, item.value), 0);
  if (items.length === 0) {
    return (
      <p className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
        {empty}
      </p>
    );
  }
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.key} className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-bold text-slate-800">{item.label}</p>
            <span className="text-sm font-black tracking-tight text-slate-900">{item.value}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100">
            <div
              className="h-2 rounded-full bg-rdpc-blue transition-all"
              style={{ width: `${maxValue > 0 ? Math.max((item.value / maxValue) * 100, 8) : 0}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

interface SignalCardProps {
  label: string;
  value: number;
  description: string;
  actionLabel: string;
  actionHref?: string;
}

const SignalCard: React.FC<SignalCardProps> = ({
  label,
  value,
  description,
  actionLabel,
  actionHref,
}) => {
  const hasSignal = value > 0 && actionHref;
  return (
    <article
      className={`rounded-[1.5rem] border bg-white px-5 py-4 shadow-sm ${
        hasSignal ? 'border-amber-200' : 'border-slate-100'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          {label}
        </p>
        {hasSignal && (
          <span className="mt-0.5 inline-flex h-2 w-2 shrink-0 rounded-full bg-amber-400" aria-hidden="true" />
        )}
      </div>
      <p className={`mt-3 text-3xl font-black tracking-tighter tabular-nums ${hasSignal ? 'text-amber-700' : 'text-slate-900'}`}>
        {value}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-slate-500">{description}</p>
      {hasSignal ? (
        <Link
          to={actionHref!}
          className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-rdpc-blue underline decoration-blue-200 underline-offset-2 hover:decoration-rdpc-blue"
        >
          {actionLabel}
          <span className="material-symbols-outlined text-[14px]" aria-hidden="true">arrow_forward</span>
        </Link>
      ) : (
        <p className="mt-3 text-xs font-medium text-emerald-700">Aucun signal.</p>
      )}
    </article>
  );
};

// ─── Composant principal ──────────────────────────────────────────────────────

export const ReportsDocumentPanel: React.FC<ReportsDocumentPanelProps> = ({
  kpis,
  granularity,
  onGranularityChange,
  selectedSeries,
  onSeriesChange,
  onRefresh,
  points,
  totalValue,
  topUnits,
  periodLabel,
  totalLabel,
  topUnitsLabel,
  timeseriesLoading = false,
  timeseriesError = null,
  activity,
  activityLoading = false,
  activityError = null,
}) => {
  return (
    <div className="space-y-6">

      {/* 1. Indicateurs ─────────────────────────────────────────────────── */}
      <section aria-label="Indicateurs documentaires">
        <h2 className="mb-3 text-[11px] font-black uppercase tracking-widest text-slate-500">
          Indicateurs
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map((kpi) => (
            <article
              key={kpi.id}
              className="rounded-[1.5rem] border border-slate-100 bg-white px-5 py-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                  {kpi.label}
                </p>
                {kpi.estimated && (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-700">
                    Estimation
                  </span>
                )}
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

      {/* 2. Évolution ───────────────────────────────────────────────────── */}
      <section aria-label="Évolution dans le temps">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-500">
            Évolution
          </h2>
          <span className="text-xs font-medium text-slate-400">{periodLabel}</span>
        </div>

        <div className="rounded-[1.5rem] border border-slate-100 bg-white px-5 py-5 shadow-sm">
          {/* Contrôles */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-1.5 py-1">
                {SERIES_OPTIONS.map((option) => {
                  const active = option.value === selectedSeries;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => onSeriesChange(option.value)}
                      className={`rounded-full px-3 py-1.5 text-xs font-black uppercase tracking-widest transition-colors ${
                        active
                          ? 'bg-rdpc-blue text-white shadow-sm'
                          : 'text-slate-500 hover:bg-white hover:text-slate-700'
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-1.5 py-1">
                {GRANULARITY_OPTIONS.map((option) => {
                  const active = option.value === granularity;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => onGranularityChange(option.value)}
                      className={`rounded-full px-3 py-1.5 text-xs font-black uppercase tracking-widest transition-colors ${
                        active
                          ? 'bg-slate-900 text-white shadow-sm'
                          : 'text-slate-500 hover:bg-white hover:text-slate-700'
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {totalLabel}
                </p>
                <p className="mt-1 text-2xl font-black tracking-tighter tabular-nums text-slate-900">
                  {totalValue}
                </p>
              </div>
              <Tooltip content="Actualiser la courbe">
                <button
                  type="button"
                  onClick={onRefresh}
                  disabled={timeseriesLoading}
                  aria-label="Actualiser la courbe"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-60"
                >
                  <span
                    className={`material-symbols-outlined text-[20px] ${timeseriesLoading ? 'animate-spin' : ''}`}
                    aria-hidden="true"
                  >
                    refresh
                  </span>
                </button>
              </Tooltip>
            </div>
          </div>

          {/* Graphe */}
          {timeseriesError ? (
            <div className="rounded-[1.5rem] border border-red-100 bg-red-50 px-5 py-4 text-sm font-bold text-red-600">
              {timeseriesError}
            </div>
          ) : timeseriesLoading ? (
            <div className="flex h-[280px] items-center justify-center">
              <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-rdpc-blue" />
            </div>
          ) : points.length > 0 ? (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={points} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={20}
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
                    formatter={((value: unknown) => [`${(value as number | undefined) ?? 0}`, totalLabel]) as never}
                    labelFormatter={(label: React.ReactNode) => label}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#1d4ed8"
                    strokeWidth={3}
                    dot={{ r: 3, fill: '#1d4ed8' }}
                    activeDot={{ r: 5, fill: '#0f172a' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-[280px] items-center justify-center rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 text-sm font-medium text-slate-500">
              Aucune donnée pour cette lecture sur la période sélectionnée.
            </div>
          )}

          {/* Top unités sous le graphe */}
          {topUnits.length > 0 && (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                {topUnitsLabel}
              </p>
              <div className="flex flex-wrap gap-2">
                {topUnits.map((unit) => (
                  <span
                    key={unit.id ?? unit.label}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700"
                  >
                    {unit.label}
                    <span className="font-black text-slate-900">{unit.value}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 3. Répartitions ────────────────────────────────────────────────── */}
      {!activityLoading && !activityError && (
        <section aria-label="Répartitions documentaires">
          <h2 className="mb-3 text-[11px] font-black uppercase tracking-widest text-slate-500">
            Répartitions
          </h2>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className="rounded-[1.5rem] border border-slate-100 bg-white px-5 py-5 shadow-sm">
              <p className="mb-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                Documents par statut
              </p>
              {renderBars(
                activity?.by_status ?? [],
                'Aucune répartition par statut disponible.',
              )}
            </div>

            <div className="rounded-[1.5rem] border border-slate-100 bg-white px-5 py-5 shadow-sm">
              <p className="mb-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                Types de fichiers les plus présents
              </p>
              {activity?.availability.by_file_type ? (
                renderBars(
                  activity.by_file_type ?? [],
                  'Aucun type de fichier remonté pour cette période.',
                )
              ) : (
                <p className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                  Types de fichiers non encore disponibles.
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* 4. Signaux ─────────────────────────────────────────────────────── */}
      {!activityLoading && !activityError && (
        <section aria-label="Signaux de vigilance">
          <h2 className="mb-3 text-[11px] font-black uppercase tracking-widest text-slate-500">
            Signaux
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SignalCard
              label="Non classés"
              value={activity?.signals.unclassified_documents ?? 0}
              description="En attente de classement ou revenus en reprise."
              actionLabel="Revoir les règles de classement"
              actionHref={
                (activity?.signals.unclassified_documents ?? 0) > 0 ? '/classement' : undefined
              }
            />
            <SignalCard
              label="Informations manquantes"
              value={activity?.signals.documents_missing_information ?? 0}
              description="Sans catégorie ou sans éléments de classement complets."
              actionLabel="Revoir les règles de classement"
              actionHref={
                (activity?.signals.documents_missing_information ?? 0) > 0
                  ? '/classement'
                  : undefined
              }
            />
            <SignalCard
              label="Documents à revoir"
              value={activity?.signals.documents_needing_review ?? 0}
              description="Décision manuelle encore attendue."
              actionLabel="Ouvrir la bannette de reprise"
              actionHref={
                (activity?.signals.documents_needing_review ?? 0) > 0
                  ? '/classification-reviews'
                  : undefined
              }
            />
            <SignalCard
              label="Imports à vérifier"
              value={activity?.signals.imports_needing_review ?? 0}
              description="Lots importés qui attendent une reprise."
              actionLabel="Ouvrir Import en masse"
              actionHref={
                (activity?.signals.imports_needing_review ?? 0) > 0 ? '/ingestion' : undefined
              }
            />
          </div>
        </section>
      )}

      {/* 5. Adoption rangement local ─────────────────────────────────────── */}
      {!activityLoading && !activityError && (
        <section aria-label="Adoption du rangement local sur poste">
          <h2 className="mb-3 text-[11px] font-black uppercase tracking-widest text-slate-500">
            Rangement local sur poste
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <SignalCard
              label="Rangements locaux"
              value={activity?.signals.local_organize_runs ?? 0}
              description="Lots rangés directement sur le poste de l'utilisateur (rien sur le serveur)."
              actionLabel="Ouvrir le journal d'audit"
              actionHref={
                (activity?.signals.local_organize_runs ?? 0) > 0 ? '/audit' : undefined
              }
            />
            <article className="rounded-[1.5rem] border border-slate-100 bg-white px-5 py-4 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Fichiers organisés
              </p>
              <p className="mt-3 text-3xl font-black tracking-tighter tabular-nums text-slate-900">
                {activity?.signals.local_organize_files ?? 0}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                Total cumulé des fichiers traités en mode local depuis le départ.
              </p>
            </article>
            <article
              className={`rounded-[1.5rem] border bg-white px-5 py-4 shadow-sm ${
                (activity?.signals.local_organize_files_unranged ?? 0) > 0
                  ? 'border-amber-200'
                  : 'border-slate-100'
              }`}
            >
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                À arbitrer côté utilisateur
              </p>
              <p
                className={`mt-3 text-3xl font-black tracking-tighter tabular-nums ${
                  (activity?.signals.local_organize_files_unranged ?? 0) > 0
                    ? 'text-amber-700'
                    : 'text-slate-900'
                }`}
              >
                {activity?.signals.local_organize_files_unranged ?? 0}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                Fichiers tombés dans « Autres » ou « Sans date » — réorientés par l'utilisateur lui-même.
              </p>
            </article>
          </div>
        </section>
      )}

      {/* Erreur activité */}
      {activityError && (
        <div className="rounded-[1.5rem] border border-red-100 bg-red-50 px-6 py-5 text-sm font-bold text-red-600">
          {activityError}
        </div>
      )}
    </div>
  );
};
