// frontend/lib/pendingAssignments.ts
import {
  defaultLocalStorage,
  readUserPreference,
  writeUserPreference,
  type KeyValueStorage,
} from './userPreferences';

export const LAST_ASSIGNED_ACTOR_KEY = 'ged.assignments.lastActor';

export function readStoredActorId(
  accountKey?: string,
  storage: KeyValueStorage | null = defaultLocalStorage(),
): string {
  return readUserPreference(LAST_ASSIGNED_ACTOR_KEY, accountKey, storage);
}

export function writeStoredActorId(
  userId: string,
  accountKey?: string,
  storage: KeyValueStorage | null = defaultLocalStorage(),
): void {
  writeUserPreference(LAST_ASSIGNED_ACTOR_KEY, userId, accountKey, storage);
}

export function resolveInitialActorId(
  users: ReadonlyArray<{ id: string }>,
  storedActorId: string,
): string {
  const trimmed = storedActorId.trim();
  if (!trimmed) return '';
  return users.some((u) => u.id === trimmed) ? trimmed : '';
}

export function filterAssignableUsers<T extends { full_name?: string | null; role_label?: string | null }>(
  users: ReadonlyArray<T>,
  query: string,
): T[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...users];
  return users.filter(
    (u) =>
      (u.full_name || '').toLowerCase().includes(needle) ||
      (u.role_label || '').toLowerCase().includes(needle),
  );
}

/**
 * Retourne l'étape suivante à sélectionner après résolution d'une étape :
 * celle qui occupait la même position (ou la précédente si c'était la dernière),
 * sinon `null` si la file est vide.
 */
export function pickNextAssignment<T extends { id: string }>(
  currentVisible: ReadonlyArray<T>,
  resolvedId: string,
): T | null {
  const remaining = currentVisible.filter((item) => item.id !== resolvedId);
  if (remaining.length === 0) return null;
  const oldIndex = currentVisible.findIndex((item) => item.id === resolvedId);
  const nextIndex = oldIndex >= 0 ? Math.min(oldIndex, remaining.length - 1) : 0;
  return remaining[nextIndex] ?? null;
}
