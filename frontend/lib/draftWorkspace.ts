// frontend/lib/draftWorkspace.ts
import {
  defaultLocalStorage,
  readUserPreference,
  writeUserPreference,
  type KeyValueStorage,
} from './userPreferences';

export const DRAFT_VALIDATOR_KEY = 'ged.draft.lastValidator';

export function readStoredValidator(
  accountKey?: string,
  storage: KeyValueStorage | null = defaultLocalStorage(),
): string {
  return readUserPreference(DRAFT_VALIDATOR_KEY, accountKey, storage);
}

export function writeStoredValidator(
  validatorId: string,
  accountKey?: string,
  storage: KeyValueStorage | null = defaultLocalStorage(),
): void {
  writeUserPreference(DRAFT_VALIDATOR_KEY, validatorId, accountKey, storage);
}

/**
 * Sélectionne automatiquement le valideur s'il est unique dans la liste,
 * sinon reprend le dernier valideur mémorisé s'il existe toujours.
 */
export function resolveInitialValidator(
  validators: ReadonlyArray<{ id: string }>,
  storedValidatorId: string,
): string {
  if (validators.length === 1 && validators[0]) {
    return validators[0].id;
  }
  const trimmed = storedValidatorId.trim();
  if (!trimmed) return '';
  return validators.some((v) => v.id === trimmed) ? trimmed : '';
}
