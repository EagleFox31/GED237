// Demandeur et date d'envoi d'une tâche de validation (cartes de /tasks, lot 12).

// Même fuseau que les filtres Du/Au du journal : heure du Cameroun, quel que soit le poste.
const LOCAL_TIME_ZONE = 'Africa/Douala';

const DATE_FORMAT = new Intl.DateTimeFormat('fr-FR', {
  timeZone: LOCAL_TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});
const TIME_FORMAT = new Intl.DateTimeFormat('fr-FR', {
  timeZone: LOCAL_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
});

/** Horodatage de l'API ; sans fuseau, il est en UTC (colonnes created_at), pas à l'heure du poste. */
export function parseApiDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/i.test(value);
  const date = new Date(hasZone ? value : `${value}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** « Envoyé par Awa Ndi le 19/11/2026 à 09:30 » ; la partie inconnue est omise, null si rien n'est connu. */
export function taskSubmissionLabel(
  submittedByName: string | null | undefined,
  createdAt: string | null | undefined,
): string | null {
  const name = submittedByName?.trim();
  const date = parseApiDate(createdAt);
  const when = date ? ` le ${DATE_FORMAT.format(date)} à ${TIME_FORMAT.format(date)}` : '';
  if (name) return `Envoyé par ${name}${when}`;
  return when ? `Envoyé${when}` : null;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
// Au-delà, l'ancienneté ne parle plus : la date du jour d'envoi la remplace.
const AGE_LIMIT_DAYS = 30;

/** « à l'instant », « il y a 5 min », « il y a 2 h », « il y a 3 j », puis « le 19/10/2026 ». */
export function submissionAge(date: Date, now: Date): string {
  const elapsed = now.getTime() - date.getTime();
  // Horloge du poste en retard sur le serveur : pas d'ancienneté négative.
  if (elapsed < MINUTE) return "à l'instant";
  if (elapsed < HOUR) return `il y a ${Math.floor(elapsed / MINUTE)} min`;
  if (elapsed < DAY) return `il y a ${Math.floor(elapsed / HOUR)} h`;
  const days = Math.floor(elapsed / DAY);
  return days <= AGE_LIMIT_DAYS ? `il y a ${days} j` : `le ${DATE_FORMAT.format(date)}`;
}

/**
 * Ligne visible « Envoyé par Awa Ndi il y a 2 h » et date exacte pour l'infobulle
 * (« Envoyé par Awa Ndi le 19/11/2026 à 09:30 ») ; null si rien n'est connu.
 */
export function taskSubmissionSummary(
  submittedByName: string | null | undefined,
  createdAt: string | null | undefined,
  now: Date = new Date(),
): { text: string; exact: string } | null {
  const exact = taskSubmissionLabel(submittedByName, createdAt);
  if (!exact) return null;
  const date = parseApiDate(createdAt);
  if (!date) return { text: exact, exact };
  const name = submittedByName?.trim();
  const age = submissionAge(date, now);
  return { text: name ? `Envoyé par ${name} ${age}` : `Envoyé ${age}`, exact };
}
