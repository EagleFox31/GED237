import React from 'react';
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

import type { ReportsServiceActivityResponse } from '../../../../services/resources/reports.api';

interface ReportsServiceActivityPanelProps {
  activity: ReportsServiceActivityResponse | null;
  loading?: boolean;
  error?: string | null;
}

const renderServiceChart = (
  items: Array<{ id: string; label: string; value: number }>,
  empty: string,
  valueLabel: string,
  color: string,
) => {
  if (items.length === 0) {
    return (
      <p className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
        {empty}
      </p>
    );
  }

  const chartHeight = Math.max(items.length * 56, 220);

  return (
    <div className="rounded-[1.5rem] border border-slate-100 bg-slate-50/60 px-4 py-4">
      <div style={{ height: chartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={items}
            layout="vertical"
            margin={{ top: 4, right: 30, left: 18, bottom: 4 }}
            barCategoryGap={16}
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
              width={180}
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
              formatter={(value) => [`${value ?? 0}`, valueLabel]}
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

export const ReportsServiceActivityPanel: React.FC<ReportsServiceActivityPanelProps> = ({
  activity,
  loading = false,
  error = null,
}) => {
  const services = activity?.services ?? [];
  const busiestServices = services
    .map((service) => ({
      id: service.id,
      label: service.label,
      value: service.documents_in_progress,
    }))
    .filter((service) => service.value > 0)
    .sort((left, right) => right.value - left.value)
    .slice(0, 6);

  const delayedServices = services
    .map((service) => ({
      id: service.id,
      label: service.label,
      value: service.estimated_delays,
    }))
    .filter((service) => service.value > 0)
    .sort((left, right) => right.value - left.value)
    .slice(0, 6);

  const servicesToReview = services
    .filter((service) => service.documents_needing_review > 0)
    .sort((left, right) => right.documents_needing_review - left.documents_needing_review)
    .slice(0, 4);

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

  return (
    <div className="space-y-6">
      <section aria-label="Charge comparée des services">
        <h2 className="mb-3 text-[11px] font-black uppercase tracking-widest text-slate-500">
          Charge par service
        </h2>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="rounded-[1.5rem] border border-slate-100 bg-white px-5 py-5 shadow-sm">
            <p className="mb-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
              Services les plus chargés
            </p>
            {renderServiceChart(
              busiestServices,
              'Aucun document en cours n’est encore visible par service.',
              'Documents en cours',
              '#2563eb',
            )}
          </div>

          <div className="rounded-[1.5rem] border border-slate-100 bg-white px-5 py-5 shadow-sm">
            <p className="mb-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
              Retards estimés par service
            </p>
            {renderServiceChart(
              delayedServices,
              'Aucun retard estimé n’apparaît encore par service.',
              'Retards estimés',
              '#f59e0b',
            )}
          </div>
        </div>
      </section>

      <section aria-label="Services à surveiller">
        <h2 className="mb-3 text-[11px] font-black uppercase tracking-widest text-slate-500">
          Services à surveiller
        </h2>

        {servicesToReview.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {servicesToReview.map((service) => (
              <article
                key={service.id}
                className="rounded-[1.5rem] border border-amber-200 bg-amber-50/40 px-5 py-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-slate-900">{service.label}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {service.documents_needing_review} document(s) à revoir, {service.documents_in_progress} en cours.
                    </p>
                  </div>
                  <span className="rounded-full border border-amber-200 bg-white px-3 py-1 text-xs font-black uppercase tracking-wider text-amber-700">
                    À revoir
                  </span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50/70 px-5 py-4">
            <p className="text-sm font-black uppercase tracking-wider text-emerald-900">
              Aucun service en reprise visible
            </p>
            <p className="mt-1 text-sm text-emerald-800">
              Aucun document à revoir n’apparaît dans les services suivis sur cette période.
            </p>
          </div>
        )}
      </section>

      <section aria-label="Liens utiles pour le pilotage des services">
        <div className="flex flex-wrap gap-3">
          <Link
            to="/org"
            className="inline-flex items-center rounded-full border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:border-rdpc-blue hover:text-rdpc-blue"
          >
            Ouvrir la structure hiérarchique
          </Link>
          <Link
            to="/users"
            className="inline-flex items-center rounded-full border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:border-rdpc-blue hover:text-rdpc-blue"
          >
            Ouvrir les agents et rôles
          </Link>
        </div>
      </section>
    </div>
  );
};
