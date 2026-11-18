// frontend/lib/lastValidatorStorage.ts
const STORAGE_PREFIX = 'ged237:lastValidator:';

export function lastValidatorKey(userKey?: string | null): string {
  const normalized = (userKey || 'anonymous').trim() || 'anonymous';
  return `${STORAGE_PREFIX}${normalized}`;
}

export function readLastValidatorId(
  userKey?: string | null,
  storage?: Pick<Storage, 'getItem'> | null,
): string {
  try {
    const target = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    if (!target) return '';
    return target.getItem(lastValidatorKey(userKey)) || '';
  } catch {
    return '';
  }
}

export function writeLastValidatorId(
  userKey: string | null | undefined,
  validatorId: string,
  storage?: Pick<Storage, 'setItem'> | null,
): void {
  if (!validatorId) return;
  try {
    const target = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    if (!target) return;
    target.setItem(lastValidatorKey(userKey), validatorId);
  } catch {
    // Repli silencieux si localStorage est bloqué ou plein.
  }
}
