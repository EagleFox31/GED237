import type { WorkSheet } from 'xlsx';
import { PREVIEW_MAX_ROWS } from './previewLimits';

type XlsxModule = typeof import('xlsx');

/** Noms des onglets seulement (`bookSheets`) : aucune cellule n'est lue. */
export function listSheets(XLSX: XlsxModule, data: ArrayBuffer): string[] {
  return XLSX.read(data, { type: 'array', bookSheets: true }).SheetNames;
}

/**
 * Un seul onglet (`sheets`), plafonné à PREVIEW_MAX_ROWS lignes (`sheetRows`) ; les autres
 * onglets ne sont pas lus. `!fullref` garde la taille réelle pour le message de troncature.
 */
export function readSheet(XLSX: XlsxModule, data: ArrayBuffer, name: string): WorkSheet | null {
  const book = XLSX.read(data, { type: 'array', sheets: name, sheetRows: PREVIEW_MAX_ROWS });
  return book.Sheets[name] ?? null;
}

/** Faux pour un onglet graphique (chartsheet) ou vide : il n'y a pas de tableau à afficher. */
export function sheetHasTable(sheet: WorkSheet | null): sheet is WorkSheet {
  return Boolean(sheet && sheet['!type'] !== 'chart' && sheet['!ref']);
}
