// Relecture du profil (#277, partie B) : au plus une fois toutes les 5 minutes, au retour sur l'onglet.
// Sans React, testé par `npm run test:unit`.

export const PROFILE_REFRESH_MIN_INTERVAL_MS = 5 * 60 * 1000;

/** `lastAt` : horodatage de la dernière relecture lancée (null si aucune depuis le chargement). */
export const shouldRefreshProfile = (lastAt: number | null, now: number): boolean =>
  lastAt === null || now - lastAt >= PROFILE_REFRESH_MIN_INTERVAL_MS;
