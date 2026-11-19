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

export type DraftStatusFilter = 'all' | 'draft' | 'rejected';

export function readDraftStatusFilter(params: URLSearchParams): DraftStatusFilter {
  const raw = (params.get('status') || '').trim();
  if (raw === 'draft' || raw === 'rejected') return raw;
  return 'all';
}

export function writeDraftStatusFilter(
  current: URLSearchParams,
  filter: DraftStatusFilter,
): URLSearchParams {
  const next = new URLSearchParams(current);
  if (filter === 'all') next.delete('status');
  else next.set('status', filter);
  return next;
}

export function filterDraftDocuments<T extends { status?: string | null }>(
  docs: ReadonlyArray<T>,
  filter: DraftStatusFilter,
): T[] {
  if (filter === 'all') return [...docs];
  return docs.filter((doc) => doc.status === filter);
}

export function countDraftStatuses<T extends { status?: string | null }>(
  docs: ReadonlyArray<T>,
): { all: number; draft: number; rejected: number } {
  let draft = 0;
  let rejected = 0;
  for (const doc of docs) {
    if (doc.status === 'draft') draft += 1;
    else if (doc.status === 'rejected') rejected += 1;
  }
  return { all: docs.length, draft, rejected };
}
