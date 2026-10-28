import React from 'react';

import { Tooltip } from '../../../../components/ui/Tooltip';
import type { ReportsKpiItem } from './reportsViewModel';

const KPI_TONE: Record<ReportsKpiItem['tone'], { value: string; icon: string; iconBg: string }> = {
  neutral: { value: 'text-slate-900', icon: 'monitoring', iconBg: 'bg-slate-100 text-slate-700' },
  good: { value: 'text-emerald-700', icon: 'task_alt', iconBg: 'bg-emerald-50 text-emerald-600' },
  warn: { value: 'text-amber-700', icon: 'warning', iconBg: 'bg-amber-50 text-amber-600' },
  info: { value: 'text-blue-700', icon: 'insights', iconBg: 'bg-blue-50 text-blue-600' },
};

interface ReportsKpiGridProps {
  items: ReportsKpiItem[];
}

export const ReportsKpiGrid: React.FC<ReportsKpiGridProps> = ({ items }) => {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => {
        const meta = KPI_TONE[item.tone];
        return (
          <article
            key={item.id}
            className="rounded-[1.5rem] border border-slate-100 bg-white px-5 py-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl ${meta.iconBg}`}>
                <span className="material-symbols-outlined text-[20px]" aria-hidden="true">{meta.icon}</span>
              </div>

              <div className="flex items-center gap-2">
                {item.estimated ? (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-700">
                    Estimation
                  </span>
                ) : null}
                <Tooltip
                  content={(
                    <span className="block max-w-[260px] whitespace-pre-line leading-relaxed">
                      {item.helper}
                    </span>
                  )}
                  side="bottom"
                  align="right"
                >
                  <button
                    type="button"
                    aria-label={`Aide — ${item.label}`}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 transition-colors hover:border-rdpc-blue/40 hover:text-rdpc-blue"
                  >
                    <span className="material-symbols-outlined text-[16px]" aria-hidden="true">help</span>
                  </button>
                </Tooltip>
              </div>
            </div>

            <p className="mt-4 text-[11px] font-black uppercase tracking-widest text-slate-500">
              {item.label}
            </p>
            <p className={`mt-2 text-3xl font-black tracking-tight tabular-nums ${meta.value}`}>
              {item.value}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              {item.shortHelper ?? item.helper}
            </p>
          </article>
        );
      })}
    </div>
  );
};
