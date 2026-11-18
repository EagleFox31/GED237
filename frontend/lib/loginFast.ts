// frontend/lib/loginFast.ts
//
// Mémorisation de l'institution et du matricule (opt-in strict) dans `localStorage`
// (`ged.login.*`) pour une reconnexion rapide sur postes partagés.

export const LOGIN_INSTITUTION_STORAGE_KEY = 'ged.login.institution';
export const LOGIN_MATRICULE_STORAGE_KEY = 'ged.login.matricule';

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function defaultLocalStorage(): KeyValueStorage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

/**
 * Lit l'institution mémorisée dans le stockage local (try/catch sécurisé).
 */
export function readStoredInstitution(
  storage: KeyValueStorage | null = defaultLocalStorage(),
): string {
  try {
    if (!storage) return '';
    return (storage.getItem(LOGIN_INSTITUTION_STORAGE_KEY) || '').trim();
  } catch {
    return '';
  }
}

/**
 * Mémorise automatiquement l'institution dans le stockage local.
 * Si la valeur est vide, supprime l'entrée.
 */
export function writeStoredInstitution(
  institution: string,
  storage: KeyValueStorage | null = defaultLocalStorage(),
): void {
  try {
    if (!storage) return;
    const trimmed = institution.trim();
    if (trimmed) {
      storage.setItem(LOGIN_INSTITUTION_STORAGE_KEY, trimmed);
    } else {
      storage.removeItem(LOGIN_INSTITUTION_STORAGE_KEY);
    }
  } catch {
    // Ignoré si localStorage est indisponible ou lève une exception de quota
  }
}

/**
 * Lit le matricule mémorisé dans le stockage local (try/catch sécurisé).
 */
export function readStoredMatricule(
  storage: KeyValueStorage | null = defaultLocalStorage(),
): string {
  try {
    if (!storage) return '';
    return (storage.getItem(LOGIN_MATRICULE_STORAGE_KEY) || '').trim();
  } catch {
    return '';
  }
}

/**
 * Mémorise le matricule si l'agent a activé l'option explicite sur le poste.
 * Si la valeur est vide, supprime l'entrée.
 */
export function writeStoredMatricule(
  matricule: string,
  storage: KeyValueStorage | null = defaultLocalStorage(),
): void {
  try {
    if (!storage) return;
    const trimmed = matricule.trim();
    if (trimmed) {
      storage.setItem(LOGIN_MATRICULE_STORAGE_KEY, trimmed);
    } else {
      storage.removeItem(LOGIN_MATRICULE_STORAGE_KEY);
    }
  } catch {
    // Ignoré si localStorage est indisponible
  }
}

/**
 * Efface le matricule mémorisé lors du décochage de l'option.
 */
export function forgetStoredMatricule(
  storage: KeyValueStorage | null = defaultLocalStorage(),
): void {
  try {
    if (!storage) return;
    storage.removeItem(LOGIN_MATRICULE_STORAGE_KEY);
  } catch {
    // Ignoré
  }
}

/**
 * Détermine si le focus initial doit être dirigé vers le champ mot de passe.
 * Condition : institution ET matricule pré-remplis (non vides).
 */
export function shouldAutoFocusPassword(
  institution: string,
  matricule: string,
): boolean {
  return Boolean(institution.trim() && matricule.trim());
}

export interface LoginAttemptPersistenceInput {
  institution: string;
  matricule: string;
  rememberMatricule: boolean;
  loginSucceeded: boolean;
  isDemo?: boolean;
}

/**
 * Persiste les préférences à l'issue d'une tentative de connexion :
 * - L'institution est mémorisée automatiquement.
 * - Si la case « Mémoriser mon matricule » est décochée, tout matricule stocké est effacé.
 * - En mode démo (`isDemo === true`), le matricule n'est jamais mémorisé.
 * - Sinon, si la case est cochée, le matricule n'est écrit qu'après une connexion réussie (`loginSucceeded === true`),
 *   afin de ne jamais mémoriser un matricule erroné.
 */
export function persistLoginAttempt(
  input: LoginAttemptPersistenceInput,
  storage: KeyValueStorage | null = defaultLocalStorage(),
): void {
  writeStoredInstitution(input.institution, storage);
  if (!input.rememberMatricule) {
    forgetStoredMatricule(storage);
    return;
  }
  if (input.isDemo) {
    return;
  }
  if (input.loginSucceeded) {
    writeStoredMatricule(input.matricule, storage);
  }
}

/**
 * Applique la sélection d'un profil de démonstration au stockage :
 * mémorise l'institution, mais ne mémorise jamais le matricule de démo.
 */
export function persistDemoSelection(
  institutionLabel: string,
  storage: KeyValueStorage | null = defaultLocalStorage(),
): void {
  writeStoredInstitution(institutionLabel, storage);
}
