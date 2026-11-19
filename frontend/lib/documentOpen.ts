// frontend/lib/documentOpen.ts
//
// Ouverture d'une fiche par lien (`?open=<id>`) : message choisi par le code HTTP, jamais le texte
// du serveur. Hors du périmètre de l'utilisateur, l'API répond 404 comme pour un document inexistant (#247).

/** Statuts que l'écran affiche lui-même (pas de toast global avec le texte du serveur). */
export const OPEN_DOCUMENT_HANDLED_STATUSES = [403, 404] as const;

export function openDocumentErrorMessage(status: number): string {
  if (status === 404) return "Ce document n'existe pas ou ne vous est pas accessible.";
  if (status === 403) return "Vous n'avez pas le droit d'ouvrir ce document.";
  return 'Ouverture du document impossible. Réessayez.';
}
