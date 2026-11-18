// Préférences de l'explorateur des espaces (V1.2, élément 22) : vue, tri et largeurs
// de colonnes, retenus dans le navigateur. Logique pure, testée par explorer-prefs.spec.ts.

export type ViewMode = 'details' | 'icons';
export type SortField = 'title' | 'size' | 'updated_at' | 'created_at';
export type SortOrder = 'asc' | 'desc';
export type DetailsColumn = 'document' | 'classement' | 'cible' | 'taille' | 'maj';

export interface ExplorerPrefs {
  view: ViewMode;
  sort: SortField;
  order: SortOrder;
  widths: Partial<Record<DetailsColumn, number>>;
}

export const EXPLORER_PREFS_KEY = 'ged237.spaces.explorer.v1';
export const MIN_COLUMN_WIDTH = 96;
const MAX_COLUMN_WIDTH = 2000;
const SORT_FIELDS: readonly SortField[] = ['title', 'size', 'updated_at', 'created_at'];
const COLUMNS: readonly DetailsColumn[] = ['document', 'classement', 'cible', 'taille', 'maj'];

export const DEFAULT_EXPLORER_PREFS: ExplorerPrefs = {
  view: 'icons',
  sort: 'updated_at',
  order: 'desc',
  widths: {},
};

type ReadableStorage = Pick<Storage, 'getItem'>;
type WritableStorage = Pick<Storage, 'setItem'>;

const browserStorage = (): Storage | null => {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
};

// Toute valeur inconnue retombe sur la valeur par défaut : une préférence
// corrompue ou d'une ancienne version ne doit jamais casser la page.
export const loadExplorerPrefs = (storage: ReadableStorage | null = browserStorage()): ExplorerPrefs => {
  try {
    const raw: unknown = JSON.parse(storage?.getItem(EXPLORER_PREFS_KEY) || '{}');
    if (!raw || typeof raw !== 'object') return DEFAULT_EXPLORER_PREFS;
    const value = raw as Record<string, unknown>;
    const widths: ExplorerPrefs['widths'] = {};
    if (value.widths && typeof value.widths === 'object') {
      Object.entries(value.widths as Record<string, unknown>).forEach(([key, width]) => {
        if (
          COLUMNS.includes(key as DetailsColumn) &&
          typeof width === 'number' &&
          width >= MIN_COLUMN_WIDTH &&
          width <= MAX_COLUMN_WIDTH
        ) {
          widths[key as DetailsColumn] = width;
        }
      });
    }
    return {
      view: value.view === 'details' || value.view === 'icons' ? value.view : DEFAULT_EXPLORER_PREFS.view,
      sort: SORT_FIELDS.includes(value.sort as SortField) ? (value.sort as SortField) : DEFAULT_EXPLORER_PREFS.sort,
      order: value.order === 'asc' || value.order === 'desc' ? value.order : DEFAULT_EXPLORER_PREFS.order,
      widths,
    };
  } catch {
    return DEFAULT_EXPLORER_PREFS;
  }
};

export const saveExplorerPrefs = (prefs: ExplorerPrefs, storage: WritableStorage | null = browserStorage()) => {
  try {
    storage?.setItem(EXPLORER_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Stockage indisponible (navigation privée, quota) : la page marche sans mémoire.
  }
};

// Clic sur un en-tête, comme dans l'Explorateur : nouvelle colonne → croissant ;
// même colonne → on inverse le sens.
export const nextSort = (
  current: { sort: SortField; order: SortOrder },
  clicked: SortField,
): { sort: SortField; order: SortOrder } => ({
  sort: clicked,
  order: clicked === current.sort && current.order === 'asc' ? 'desc' : 'asc',
});

export const clampColumnWidth = (width: number) =>
  Math.round(Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, width)));
