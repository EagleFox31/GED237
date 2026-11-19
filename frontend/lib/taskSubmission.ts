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
