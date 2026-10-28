import React from 'react';
import { Link } from 'react-router-dom';

import type { ReportsInsightItem } from './reportsViewModel';

const INSIGHT_STYLES: Record<ReportsInsightItem['tone'], string> = {
  neutral: 'border-slate-100 bg-white',
  good: 'border-emerald-100 bg-emerald-50/60',
  warn: 'border-amber-100 bg-amber-50/70',
};

const INSIGHT_LABELS: Record<ReportsInsightItem['tone'], string> = {
  neutral: 'Indicateur',
  good: 'Situation stable',
  warn: 'À surveiller',
};

interface ReportsInsightsPanelProps {
  items: ReportsInsightItem[];
}

export const ReportsInsightsPanel: React.FC<ReportsInsightsPanelProps> = ({ items }) => {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      {items.map((item) => (
        <div
          key={item.id}
          className={`rounded-[1.75rem] border p-6 shadow-sm ${INSIGHT_STYLES[item.tone]}`}
        >
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            {INSIGHT_LABELS[item.tone]}
          </p>
          <div className="mt-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-lg font-black uppercase italic tracking-tight text-slate-900">
                {item.title}
              </p>
              <p className="mt-3 text-4xl font-black tracking-tighter text-slate-900">
                {item.value}
              </p>
            </div>
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-600">{item.helper}</p>
          {item.actionLabel && item.actionHref ? (
            <div className="mt-5">
              <Link
                to={item.actionHref}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-800"
              >
                {item.actionLabel}
                <span className="material-symbols-outlined text-base">arrow_forward</span>
              </Link>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
};
