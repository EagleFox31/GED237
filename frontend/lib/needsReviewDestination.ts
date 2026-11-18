// frontend/lib/needsReviewDestination.ts
import {
  defaultLocalStorage,
  readUserPreference,
  writeUserPreference,
  type KeyValueStorage,
} from './userPreferences';

export const NEEDS_REVIEW_DESTINATION_KEY = 'ged.needsReview.lastDestination';

export function readStoredDestination(
  accountKey?: string,
  storage: KeyValueStorage | null = defaultLocalStorage(),
): string {
  return readUserPreference(NEEDS_REVIEW_DESTINATION_KEY, accountKey, storage);
}

export function writeStoredDestination(
  folderId: string,
  accountKey?: string,
  storage: KeyValueStorage | null = defaultLocalStorage(),
): void {
  writeUserPreference(NEEDS_REVIEW_DESTINATION_KEY, folderId, accountKey, storage);
}

export function resolveInitialDestination(
  orgUnits: ReadonlyArray<{ id: string }>,
  storedFolderId: string,
): string {
  const trimmed = storedFolderId.trim();
  if (!trimmed) return '';
  return orgUnits.some((unit) => unit.id === trimmed) ? trimmed : '';
}
