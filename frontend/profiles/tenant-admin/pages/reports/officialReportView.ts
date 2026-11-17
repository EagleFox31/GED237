// Règles d'affichage du modal « Copie officielle », sans React, testées par `npm run test:unit`.

export type OfficialSection = 'issue' | 'register' | 'schedules';

export const SECTION_LABELS: Record<OfficialSection, string> = {
  issue: 'Émettre',
  register: 'Registre',
  schedules: 'Programmés',
};

/** « Programmés » n'apparaît que si le serveur exécute les rapports programmés. */
export const visibleSections = (schedulingEnabled: boolean): OfficialSection[] =>
  schedulingEnabled ? ['issue', 'register', 'schedules'] : ['issue', 'register'];

/** En-tête `X-Scheduled-Reports-Enabled` : absent ou autre que « true » = désactivé (défaut serveur). */
export const schedulingEnabledFrom = (header: string | null | undefined): boolean =>
  header?.trim().toLowerCase() === 'true';

/** Navigation clavier d'une liste d'onglets (motif ARIA « tabs », activation automatique). */
export const nextSection = (
  sections: readonly OfficialSection[],
  current: OfficialSection,
  key: string,
): OfficialSection | null => {
  const index = sections.indexOf(current);
  if (index < 0 || sections.length === 0) return null;
  const last = sections.length - 1;
  const target =
    key === 'ArrowRight' ? (index === last ? 0 : index + 1)
    : key === 'ArrowLeft' ? (index === 0 ? last : index - 1)
    : key === 'Home' ? 0
    : key === 'End' ? last
    : null;
  return target === null ? null : sections[target] ?? null;
};

export type RegisterLoad = 'loading' | 'ready' | 'denied' | 'failed';

/** 403 : message d'accès ; autre échec : registre indisponible (le détail passe par le bus). */
export const registerLoadFromError = (error: unknown): RegisterLoad =>
  (error as { status?: unknown } | null)?.status === 403 ? 'denied' : 'failed';

/** Message à la place de la liste, ou `null` quand la liste s'affiche. */
export const registerMessage = (load: RegisterLoad, count: number): string | null => {
  if (load === 'loading' && count === 0) return 'Chargement…';
  if (load === 'denied') return "Vous n'avez pas accès au registre.";
  if (load === 'failed' && count === 0) return 'Registre indisponible pour le moment.';
  if (load === 'ready' && count === 0) return 'Aucune copie émise.';
  return null;
};

/** Pendant une émission, le modal reste ouvert : le numéro attribué doit être vu. */
export const canClose = (busy: boolean): boolean => !busy;
