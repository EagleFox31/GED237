import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import {
  isAllZero, isValidTrends, pointTitle, seriesSummary, toPoints,
  TREND_EMPTY, TREND_UNAVAILABLE, TREND_WEEKS,
  type TrendLine, type TrendScope, type TrendsResponse,
} from '../lib/trends';

const W = 300;
const H = 90;

/** Courbe SVG : trait plein, dernier segment (semaine en cours) en pointillé. Échelle commune aux traits. */
const TrendChart: React.FC<{ weeks: string[]; lines: TrendLine[]; ariaLabel: string }> = ({ weeks, lines, ariaLabel }) => {
  const max = Math.max(1, ...lines.flatMap((l) => l.values));
  return (
    <svg viewBox={`-4 -6 ${W + 8} ${H + 12}`} className="w-full h-24" role="img" aria-label={ariaLabel}>
      <line x1="0" y1={H} x2={W} y2={H} className="stroke-slate-200" strokeWidth="1" />
      {lines.map((line) => {
        const pts = toPoints(line.values, W, H, max);
        const solid = pts.slice(0, -1).map((p) => p.join(',')).join(' ');
        const tail = pts.slice(-2).map((p) => p.join(',')).join(' ');
        return (
          <g key={line.label} fill="none" stroke={line.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
            {pts.length > 2 && <polyline points={solid} />}
            <polyline points={tail} strokeDasharray="4 3" />
            {pts.map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r="3" fill={line.color} stroke="none">
                <title>{`${line.label} — ${pointTitle(weeks, i, line.values[i])}`}</title>
              </circle>
            ))}
          </g>
        );
      })}
    </svg>
  );
};

const Legend: React.FC<{ lines: TrendLine[] }> = ({ lines }) => (
  <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-bold text-slate-600">
    {lines.map((l) => (
      <li key={l.label} className="flex items-center gap-1.5">
        <span aria-hidden className="inline-block w-3 h-1 rounded" style={{ background: l.color }} />
        {l.label}
      </li>
    ))}
  </ul>
);

const Card: React.FC<{ title: string; testId: string; children: React.ReactNode }> = ({ title, testId, children }) => (
  <section data-testid={testId} className="glass p-6 rounded-[2rem] bg-white border-white space-y-3">
    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest italic">{title}</h3>
    {children}
  </section>
);

export interface TrendCardsLabels {
  created: { title: string; line: string };
  visas: { title: string; accepted: string; rejected: string };
}

export const TREND_LABELS: Record<TrendScope, TrendCardsLabels> = {
  tenant: { created: { title: 'Documents déposés', line: 'Déposés' }, visas: { title: 'Visas rendus', accepted: 'Acceptés', rejected: 'Rejetés ou renvoyés' } },
  unit: { created: { title: 'Documents déposés', line: 'Déposés' }, visas: { title: 'Visas rendus', accepted: 'Acceptés', rejected: 'Rejetés ou renvoyés' } },
  mine: { created: { title: 'Mes dépôts', line: 'Déposés' }, visas: { title: 'Issue de mes documents', accepted: 'Visés', rejected: 'Rejetés ou renvoyés' } },
};

const COLORS = { blue: '#2563eb', green: '#059669', red: '#dc2626' };

/** Deux cartes de tendance (12 semaines) pour un périmètre ; un échec n'affecte pas le reste de la page. */
export const TrendCards: React.FC<{ scope: TrendScope; onLoaded?: (t: TrendsResponse) => void }> = ({ scope, onLoaded }) => {
  const [data, setData] = useState<TrendsResponse | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    api.getTrends(scope, TREND_WEEKS)
      .then((res: unknown) => {
        if (cancelled) return;
        if (isValidTrends(res)) { setData(res); setState('ready'); onLoaded?.(res); } else setState('error');
      })
      .catch(() => { if (!cancelled) setState('error'); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  const labels = TREND_LABELS[scope];
  const cards: Array<{ title: string; testId: string; lines: TrendLine[] }> = data ? [
    { title: labels.created.title, testId: 'trend-created', lines: [{ label: labels.created.line, values: data.series.documents_created, color: COLORS.blue }] },
    { title: labels.visas.title, testId: 'trend-visas', lines: [
      { label: labels.visas.accepted, values: data.series.visas_accepted, color: COLORS.green },
      { label: labels.visas.rejected, values: data.series.visas_rejected_or_returned, color: COLORS.red },
    ] },
  ] : [{ title: labels.created.title, testId: 'trend-created', lines: [] }, { title: labels.visas.title, testId: 'trend-visas', lines: [] }];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="trend-cards" aria-busy={state === 'loading'}>
      {cards.map((c) => (
        <Card key={c.testId} title={c.title} testId={c.testId}>
          {state === 'loading' && <div className="h-24 rounded-2xl bg-slate-50 animate-pulse" />}
          {state === 'error' && <p className="text-xs font-bold text-slate-500" role="status">{TREND_UNAVAILABLE}</p>}
          {state === 'ready' && data && (isAllZero(c.lines)
            ? <p className="text-xs font-bold text-slate-500">{TREND_EMPTY}</p>
            : (<>
                <TrendChart weeks={data.weeks} lines={c.lines} ariaLabel={`${c.title} : ${c.lines.map((l) => `${l.label}, ${seriesSummary(data.weeks, l.values)}`).join(' ; ')}`} />
                <Legend lines={c.lines} />
              </>))}
        </Card>
      ))}
    </div>
  );
};

export default TrendCards;
