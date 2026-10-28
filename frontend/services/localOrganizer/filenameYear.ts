import { SANS_DATE } from './constants';

export const yearFromFilename = (filename: string): number | null => {
  const match = filename.match(/\b(?:19|20)\d{2}\b/);
  return match ? Number.parseInt(match[0], 10) : null;
};

/** Origine du segment année utilisé dans les chemins. */
export type YearSource = 'filename' | 'metadata' | 'unknown';

export const yearInfoForFile = (file: File): { year: string; source: YearSource } => {
  const yFromName = yearFromFilename(file.name);
  if (yFromName !== null && yFromName >= 1970 && yFromName <= 9999) {
    return { year: String(yFromName), source: 'filename' };
  }
  if (!file.lastModified) return { year: SANS_DATE, source: 'unknown' };
  const year = new Date(file.lastModified).getFullYear();
  if (!Number.isFinite(year) || year < 1970 || year > 9999) {
    return { year: SANS_DATE, source: 'unknown' };
  }
  return { year: String(year), source: 'metadata' };
};
