// frontend/lib/userPreferences.ts
//
// Helpers génériques pour mémoriser des préférences de confort par utilisateur
// dans `localStorage`, toujours protégés par `try/catch`.

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function defaultLocalStorage(): KeyValueStorage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function scopedStorageKey(baseKey: string, accountKey?: string): string {
  const clean = (accountKey ?? '').trim();
  return clean ? `${baseKey}.${clean}` : `${baseKey}.anon`;
}

export function readUserPreference(
  baseKey: string,
  accountKey?: string,
  storage: KeyValueStorage | null = defaultLocalStorage(),
): string {
  try {
    if (!storage) return '';
    return (storage.getItem(scopedStorageKey(baseKey, accountKey)) || '').trim();
  } catch {
    return '';
  }
}

export function writeUserPreference(
  baseKey: string,
  value: string,
  accountKey?: string,
  storage: KeyValueStorage | null = defaultLocalStorage(),
): void {
  try {
    if (!storage) return;
    const key = scopedStorageKey(baseKey, accountKey);
    const trimmed = value.trim();
    if (trimmed) storage.setItem(key, trimmed);
    else storage.removeItem(key);
  } catch {
    // Ignoré si localStorage est indisponible ou bloqué.
  }
}
