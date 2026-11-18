// frontend/lib/lastValidatorStorage.ts
const STORAGE_PREFIX = 'ged237:lastValidator:';

/** Who owns the remembered choice: the tenant plus the user's matricule (unique per tenant). */
export interface LastValidatorOwner {
  tenantId?: string | null;
  matricule?: string | null;
}

/** Storage key, or null when the owner is not fully known: then nothing is remembered. */
export function lastValidatorKey(owner?: LastValidatorOwner | null): string | null {
  const tenantId = owner?.tenantId?.trim();
  const matricule = owner?.matricule?.trim();
  if (!tenantId || !matricule) return null;
  return `${STORAGE_PREFIX}${tenantId}:${matricule}`;
}

export function readLastValidatorId(
  owner?: LastValidatorOwner | null,
  storage?: Pick<Storage, 'getItem'> | null,
): string {
  const key = lastValidatorKey(owner);
  if (!key) return '';
  try {
    const target = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    if (!target) return '';
    return target.getItem(key) || '';
  } catch {
    return '';
  }
}

export function writeLastValidatorId(
  owner: LastValidatorOwner | null | undefined,
  validatorId: string,
  storage?: Pick<Storage, 'setItem'> | null,
): void {
  const key = lastValidatorKey(owner);
  if (!key || !validatorId) return;
  try {
    const target = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    if (!target) return;
    target.setItem(key, validatorId);
  } catch {
    // Repli silencieux si localStorage est bloqué ou plein.
  }
}
