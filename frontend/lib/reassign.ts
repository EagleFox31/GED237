// L12-5 (V1.1) : confier une étape non traitée à un autre valideur (absence imprévue).

/** Profils autorisés à assigner (policy.csv : workflows assign ou manage). */
export const REASSIGN_PROFILES: ReadonlySet<string> = new Set(['super', 'tenant', 'unit', 'manager']);

/** Étapes encore à traiter : en cours, ou en attente d'une étape précédente. */
const REASSIGNABLE_STATUSES: ReadonlySet<string> = new Set(['current', 'pending']);

/** Le bouton « Réassigner » s'affiche pour une étape à traiter, aux profils qui assignent. */
export function canReassignStep(profileId: string | undefined, step: { status: string }): boolean {
  return !!profileId && REASSIGN_PROFILES.has(profileId) && REASSIGNABLE_STATUSES.has(step.status);
}

/** Valideurs proposés : tous sauf celui qui a déjà la tâche, triés par nom. */
export function reassignCandidates<T extends { id: string; full_name: string }>(
  validators: readonly T[],
  currentAssigneeId: string | null | undefined,
): T[] {
  return validators
    .filter((v) => v.id !== currentAssigneeId)
    .sort((a, b) => a.full_name.localeCompare(b.full_name, 'fr'));
}
