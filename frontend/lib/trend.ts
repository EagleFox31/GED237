// Tendance d'un indicateur : calculs purs (sans réseau ni React), testés par `npm run test:unit`.

export interface TrendPoint {
  /** Début de la période (ISO, jour ou semaine). */
  date: string;
  value: number;
}

export interface TrendSummary {
  /** Dernière valeur, ou null s'il n'y a aucune donnée. */
  latest: number | null;
  /** Écart avec la valeur précédente ; null si moins de deux points. */
  delta: number | null;
  direction: 'up' | 'down' | 'flat' | 'none';
}

export const summarize = (points: TrendPoint[]): TrendSummary => {
  if (points.length === 0) return { latest: null, delta: null, direction: 'none' };
  const latest = points[points.length - 1]!.value;
  if (points.length < 2) return { latest, delta: null, direction: 'none' };
  const delta = latest - points[points.length - 2]!.value;
  return { latest, delta, direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat' };
};

/** Aucune courbe utile : pas de point, ou rien d'autre que des zéros. */
export const isEmpty = (points: TrendPoint[]): boolean => points.every((p) => p.value === 0);

/** Tracé SVG (viewBox width × height, marge `pad`) ; l'axe part de 0 pour ne pas gonfler les petites variations. */
export const linePath = (points: TrendPoint[], width: number, height: number, pad = 2): string => {
  if (points.length === 0) return '';
  const max = Math.max(...points.map((p) => p.value), 1);
  const step = points.length > 1 ? (width - 2 * pad) / (points.length - 1) : 0;
  return points
    .map((p, i) => {
      const x = pad + (points.length > 1 ? i * step : (width - 2 * pad) / 2);
      const y = height - pad - (p.value / max) * (height - 2 * pad);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
};

/** Phrase d'évolution en français simple. */
export const deltaLabel = (s: TrendSummary, unit = ''): string => {
  if (s.direction === 'none' || s.delta === null) return 'Pas assez de recul';
  if (s.direction === 'flat') return 'Stable';
  const sign = s.delta > 0 ? '+' : '−';
  return `${sign}${Math.abs(s.delta)}${unit} sur la période précédente`;
};
