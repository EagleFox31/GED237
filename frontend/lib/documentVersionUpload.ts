// frontend/lib/documentVersionUpload.ts
//
// Nouvelle version d'un fichier depuis la fiche (#275) : messages d'erreur choisis par le code HTTP
// et le code d'erreur de l'API (POST /documents/{id}/versions), jamais par le texte du serveur.

/** Statuts que l'écran affiche lui-même (pas de toast global avec le texte du serveur). */
export const VERSION_UPLOAD_HANDLED_STATUSES = [400, 403, 409, 413, 423] as const;

/** Codes 409 de l'API (`error` du détail, mis en majuscules par le backend). */
const DUPLICATE_MESSAGES: Record<string, string> = {
  IDENTICAL_TO_CURRENT: 'Ce fichier est identique à la version actuelle.',
  IDENTICAL_TO_PREVIOUS_VERSION: 'Ce fichier est identique à une ancienne version.',
  DUPLICATE_FILE: 'Ce fichier existe déjà dans un autre document.',
};

export function versionUploadErrorMessage(status: number, errorCode?: string): string {
  if (status === 413) return 'Fichier trop volumineux.';
  if (status === 423) return 'Document réservé par une autre personne.';
  if (status === 409) return DUPLICATE_MESSAGES[(errorCode ?? '').toUpperCase()] ?? 'Ce fichier existe déjà.';
  if (status === 403) return "Vous n'avez pas le droit de modifier ce document.";
  // 400 hors corbeille (le bouton y est masqué) : compte sans service de rattachement.
  if (status === 400) return "Envoi impossible : votre compte n'est rattaché à aucun service.";
  return 'Envoi impossible. Réessayez.';
}
