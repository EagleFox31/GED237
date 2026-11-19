// Mémorise le dernier valideur choisi (par compte, dans ce navigateur) : l'agent qui soumet en série
// n'a pas à le resélectionner à chaque document. Commodité seulement : sans stockage, rien ne casse.

const keyFor = (userId: string) => `ged237.lastValidator.${userId}`;

/** Valideur proposé d'office : le dernier choisi s'il est toujours proposable, sinon le seul de la liste. */
export function pickInitialValidator(saved: string | null, validatorIds: string[]): string {
  if (saved && validatorIds.includes(saved)) return saved;
  return validatorIds.length === 1 ? validatorIds[0] ?? '' : '';
}

export function readLastValidator(userId: string | undefined): string | null {
  if (!userId) return null;
  try {
    return window.localStorage.getItem(keyFor(userId));
  } catch {
    return null;
  }
}

export function saveLastValidator(userId: string | undefined, validatorId: string): void {
  if (!userId) return;
  try {
    window.localStorage.setItem(keyFor(userId), validatorId);
  } catch {
    // Stockage indisponible (navigation privée, quota) : on retombe sur le choix manuel.
  }
}
