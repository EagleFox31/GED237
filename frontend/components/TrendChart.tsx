import React from 'react';
import { deltaLabel, isEmpty, linePath, summarize, type TrendPoint } from '../lib/trend';

interface Props {
  title: string;
  points: TrendPoint[];
  /** Texte quand il n'y a rien à tracer (défini par le tableau de bord appelant). */
  emptyText?: string;
  /** Vrai si une hausse est une mauvaise nouvelle (ex. documents en retard). */
  upIsBad?: boolean;
  testId?: string;
}

const W = 120;
const H = 36;

/** Petite courbe de tendance : valeur actuelle, écart, tracé SVG. Aucune bibliothèque. */
export const TrendChart: React.FC<Props> = ({ title, points, emptyText = 'Pas encore de données', upIsBad = false, testId = 'trend' }) => {
  const summary = summarize(points);
  const empty = isEmpty(points);
  const bad = summary.direction === 'up' ? upIsBad : summary.direction === 'down' ? !upIsBad : false;
  const tone = summary.direction === 'flat' || summary.direction === 'none' ? 'text-slate-500' : bad ? 'text-red-600' : 'text-emerald-600';
  const arrow = summary.direction === 'up' ? 'trending_up' : summary.direction === 'down' ? 'trending_down' : 'trending_flat';

  return (
    <div data-testid={testId} data-direction={empty ? 'none' : summary.direction} className="rounded-2xl border border-slate-100 bg-white p-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{title}</p>
      {empty ? (
        <p data-testid={`${testId}-empty`} className="mt-3 text-xs font-medium text-slate-500">{emptyText}</p>
      ) : (
        <>
          <div className="mt-1 flex items-end justify-between gap-3">
            <p data-testid={`${testId}-value`} className="text-2xl font-black text-slate-800">{summary.latest}</p>
            <svg role="img" aria-label={`Tendance : ${title}`} viewBox={`0 0 ${W} ${H}`} width={W} height={H} className={tone}>
              <path d={linePath(points, W, H)} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p data-testid={`${testId}-delta`} className={`mt-1 flex items-center gap-1 text-[11px] font-bold ${tone}`}>
            <span className="material-symbols-outlined text-sm" aria-hidden="true">{arrow}</span>
            {deltaLabel(summary)}
          </p>
        </>
      )}
    </div>
  );
};
