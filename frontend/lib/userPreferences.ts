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

/**
 * Clé de stockage propre au compte, ou `null` si le compte n'est pas identifié : clé vide,
 * ou clé `tenant:matricule` à laquelle il manque une partie (« :MAT001 »). Sans compte
 * identifié, rien n'est lu ni écrit : deux comptes ne doivent jamais partager une préférence.
 */
export function scopedStorageKey(baseKey: string, accountKey?: string): string | null {
  const clean = (accountKey ?? '').trim();
  if (!clean || clean.split(':').some((part) => !part.trim())) return null;
  return `${baseKey}.${clean}`;
}

export function readUserPreference(
  baseKey: string,
  accountKey?: string,
  storage: KeyValueStorage | null = defaultLocalStorage(),
): string {
  try {
    const key = scopedStorageKey(baseKey, accountKey);
    if (!storage || !key) return '';
    return (storage.getItem(key) || '').trim();
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
    const key = scopedStorageKey(baseKey, accountKey);
    if (!storage || !key) return;
    const trimmed = value.trim();
    if (trimmed) storage.setItem(key, trimmed);
    else storage.removeItem(key);
  } catch {
    // Ignoré si localStorage est indisponible ou bloqué.
  }
}
