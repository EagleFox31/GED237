// Tendances hebdomadaires (GET /analytics/trends) : contrat et petites fonctions pures, sans dépendance d'affichage.
// Contrat : weeks = lundis ISO du plus ancien au plus récent (le dernier est la semaine en cours),
// chaque série a la même longueur que weeks, semaines vides à 0 (complétées par le serveur).

export type TrendScope = 'tenant' | 'unit' | 'mine';

export interface TrendsResponse {
  scope: TrendScope;
  timezone?: string;
  weeks: string[];
  series: {
    documents_created: number[];
    visas_accepted: number[];
    visas_rejected_or_returned: number[];
  };
  now?: { drafts: number; awaiting_visa: number };
}

export interface TrendLine {
  label: string;
  values: number[];
  color: string;
}

export const TREND_WEEKS = 12;
export const TREND_EMPTY = 'Pas encore d’activité ces 12 dernières semaines.';
export const TREND_UNAVAILABLE = 'Tendance indisponible';

const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

/** « 3 nov. » à partir de « 2026-11-03 » (pas de fuseau : la date est déjà celle de Douala). */
export function shortDate(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  if (!m || !d) return iso;
  return `${d} ${MONTHS[m - 1]}`;
}

/** Vrai si la réponse est exploitable : séries alignées sur les semaines, nombres finis. */
export function isValidTrends(data: unknown): data is TrendsResponse {
  const t = data as TrendsResponse | null;
  if (!t || !Array.isArray(t.weeks) || t.weeks.length === 0 || !t.series) return false;
  return Object.values(t.series).every(
    (s) => Array.isArray(s) && s.length === t.weeks.length && s.every((v) => Number.isFinite(v)),
  );
}

export function isAllZero(lines: ReadonlyArray<Pick<TrendLine, 'values'>>): boolean {
  return lines.every((l) => l.values.every((v) => v === 0));
}

/** Infobulle d'un point : « Semaine du 3 nov. : 5 », « Semaine en cours » pour le dernier. */
export function pointTitle(weeks: string[], index: number, value: number): string {
  const base = `Semaine du ${shortDate(weeks[index])} : ${value}`;
  return index === weeks.length - 1 ? `${base} (semaine en cours)` : base;
}

/** Résumé pour lecteur d'écran : « 12 semaines, du 25 août au 10 nov. ; cette semaine : 5 ». */
export function seriesSummary(weeks: string[], values: number[]): string {
  const last = values[values.length - 1] ?? 0;
  return `${weeks.length} semaines, du ${shortDate(weeks[0])} au ${shortDate(weeks[weeks.length - 1])} ; cette semaine : ${last}`;
}

/** Points SVG (x, y) d'une série dans un cadre w×h, y inversé, échelle commune `max` (≥ 1). */
export function toPoints(values: number[], w: number, h: number, max: number): Array<[number, number]> {
  const top = Math.max(1, max);
  const step = values.length > 1 ? w / (values.length - 1) : 0;
  return values.map((v, i) => [i * step, h - (Math.max(0, v) / top) * h]);
}
