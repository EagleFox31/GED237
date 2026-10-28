import React from 'react';

import type { ReportsWorkflowActivityResponse } from '../../../../services/resources/reports.api';

interface ReportsWorkflowActivityPanelProps {
  activity: ReportsWorkflowActivityResponse | null;
  loading?: boolean;
  error?: string | null;
}

const renderCountBars = (
  items: Array<{ key: string; label: string; value: number }>,
  empty: string,
) => {
  const maxValue = items.reduce((current, item) => Math.max(current, item.value), 0);
  if (items.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
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

const renderDelayBars = (
  items: Array<{ key: string; label: string; average_days: number; steps_count: number }>,
  empty: string,
) => {
  const maxValue = items.reduce((current, item) => Math.max(current, item.average_days), 0);
  if (items.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
        {empty}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.key} className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-slate-800">{item.label}</p>
              <p className="text-xs text-slate-500">{item.steps_count} étape(s) terminée(s)</p>
            </div>
            <span className="text-sm font-black tracking-tight text-slate-900">{item.average_days} j</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100">
            <div
              className="h-2 rounded-full bg-amber-500 transition-all"
              style={{ width: `${maxValue > 0 ? Math.max((item.average_days / maxValue) * 100, 8) : 0}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

export const ReportsWorkflowActivityPanel: React.FC<ReportsWorkflowActivityPanelProps> = ({
  activity,
  loading = false,
  error = null,
}) => {
  const blockedCount = activity?.blocked_workflows_estimated ?? 0;
  const slowestService = activity?.delay_by_org_unit?.[0] ?? null;

  return (
    <div className="overflow-hidden rounded-[2rem] border border-slate-100 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-8 py-6">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          Workflows & délais
        </p>
        <h3 className="mt-2 text-2xl font-black uppercase italic tracking-tighter text-slate-900">
          Où les circuits ralentissent
        </h3>
      </div>

      {loading ? (
        <div className="flex items-center justify-center px-8 py-14">
          <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-rdpc-blue" />
        </div>
      ) : error ? (
        <div className="px-8 py-10">
          <div className="rounded-[1.5rem] border border-red-100 bg-red-50 px-6 py-5 text-sm font-bold text-red-600">
            {error}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 px-8 py-8 xl:grid-cols-2">
          <div className="rounded-[1.75rem] border border-amber-100 bg-amber-50/40 p-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">
              Blocages estimés
            </p>
            <div className="mt-4 flex items-end justify-between gap-4">
              <div>
                <p className="text-4xl font-black tracking-tighter text-slate-900">
                  {blockedCount}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Circuit(s) encore ouverts depuis plus de cinq jours.
                </p>
              </div>
              <span className="material-symbols-outlined text-4xl text-amber-500" aria-hidden="true">
                hourglass_top
              </span>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-slate-100 bg-white p-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Service le plus lent
            </p>
            {slowestService ? (
              <div className="mt-4">
                <p className="text-lg font-black text-slate-900">{slowestService.label}</p>
                <p className="mt-2 text-4xl font-black tracking-tighter text-slate-900">
                  {slowestService.average_days} j
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  {slowestService.steps_count} étape(s) terminée(s) sur cette lecture.
                </p>
              </div>
            ) : (
              <p className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                Aucun délai moyen par service n’est encore disponible.
              </p>
            )}
          </div>

          <div className="rounded-[1.75rem] border border-slate-100 bg-slate-50/70 p-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Étapes en attente
            </p>
            <div className="mt-4">
              {activity?.availability.by_step ? (
                renderCountBars(
                  activity?.by_step ?? [],
                  'Aucune étape ouverte n’est encore remontée pour cette période.',
                )
              ) : (
                <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                  Cette lecture sera activée dès que la ventilation par étape sera stabilisée.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-slate-100 bg-white p-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Attentes principales
            </p>
            <div className="mt-4">
              {activity?.availability.pending_actions ? (
                renderCountBars(
                  activity?.pending_actions ?? [],
                  'Aucune attente principale n’est encore disponible.',
                )
              ) : (
                <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                  Cette lecture sera activée dès que les attentes par type d’action seront disponibles.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-slate-100 bg-white p-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Étapes les plus lentes
            </p>
            <div className="mt-4">
              {renderDelayBars(
                activity?.slowest_steps ?? [],
                'Aucun délai moyen par étape n’est encore disponible.',
              )}
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-slate-100 bg-white p-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">
              Délais moyens par service
            </p>
            <div className="mt-4">
              {activity?.availability.delay_by_org_unit ? (
                renderDelayBars(
                  activity?.delay_by_org_unit ?? [],
                  'Aucun délai moyen par service n’est encore disponible.',
                )
              ) : (
                <p className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-5 text-sm text-slate-500">
                  Cette lecture sera ouverte dès que les agrégats par service seront stabilisés.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
