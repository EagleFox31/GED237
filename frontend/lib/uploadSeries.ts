// frontend/lib/uploadSeries.ts
//
// Mémorisation de la catégorie et du mode de traitement dans `sessionStorage`
// (`ged.upload.*`) et réinitialisation ciblée pour l'action « Déposer et en ajouter un autre ».

export type UploadProcessingMode = 'archive' | 'process';

export const UPLOAD_CATEGORY_STORAGE_KEY = 'ged.upload.category';
export const UPLOAD_MODE_STORAGE_KEY = 'ged.upload.processingMode';

export const UPLOAD_SUCCESS_SERIES_MESSAGE = 'Document déposé.';
export const DUPLICATE_DOCUMENT_MESSAGE =
  'Un fichier identique existe déjà dans votre espace. Le fichier reste sélectionné pour vous permettre de modifier ses informations ou de vérifier vos doublons avant de réessayer.';

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface StoredUploadPreferences {
  category: string;
  processingMode: UploadProcessingMode;
}

export interface UploadSeriesState {
  file: File | null;
  title: string;
  category: string;
  processingMode: UploadProcessingMode;
  tags: string;
  description: string;
}

function defaultSessionStorage(): KeyValueStorage | null {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

export function readUploadPreferences(
  storage: KeyValueStorage | null = defaultSessionStorage(),
): StoredUploadPreferences {
  try {
    if (!storage) return { category: '', processingMode: 'process' };
    const rawCategory = (storage.getItem(UPLOAD_CATEGORY_STORAGE_KEY) || '').trim();
    const rawMode = (storage.getItem(UPLOAD_MODE_STORAGE_KEY) || '').trim();
    const processingMode: UploadProcessingMode =
      rawMode === 'archive' ? 'archive' : 'process';
    return { category: rawCategory, processingMode };
  } catch {
    return { category: '', processingMode: 'process' };
  }
}

export function writeUploadPreferences(
  prefs: StoredUploadPreferences,
  storage: KeyValueStorage | null = defaultSessionStorage(),
): void {
  try {
    if (!storage) return;
    storage.setItem(UPLOAD_CATEGORY_STORAGE_KEY, prefs.category.trim());
    storage.setItem(UPLOAD_MODE_STORAGE_KEY, prefs.processingMode);
  } catch {
    // Ignoré si sessionStorage est indisponible ou bloqué.
  }
}

export function resolveStoredCategory(
  storedCategory: string,
  availableCategories: ReadonlyArray<{ id: string }>,
): string {
  const trimmed = storedCategory.trim();
  if (!trimmed) return '';
  return availableCategories.some((cat) => cat.id === trimmed) ? trimmed : '';
}

export function resetForNextUpload(state: UploadSeriesState): UploadSeriesState {
  return {
    ...state,
    file: null,
    title: '',
  };
}
