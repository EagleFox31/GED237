/** Titre proposé pour un fichier : son nom sans extension. */
export function titleFromFileName(name: string): string {
  return name.replace(/\.[^/.]+$/, '');
}

/**
 * Titre à afficher quand le fichier change : il suit le nouveau fichier, sauf si
 * l'utilisateur l'a saisi à la main.
 */
export function nextTitle(current: string, titleEditedByHand: boolean, fileName: string): string {
  return titleEditedByHand && current.trim() ? current : titleFromFileName(fileName);
}

/** Message affiché dans la fenêtre quand le poste est déjà hors ligne : rien n'est envoyé. */
export const OFFLINE_UPLOAD_MESSAGE = 'Vous êtes hors ligne. Votre saisie est gardée : renvoyez dès le retour du réseau.';

/**
 * Échec d'envoi déjà annoncé par le bandeau global : coupure réseau (pas de réponse du
 * serveur). La fenêtre n'ajoute pas un second message (audit UX lot 6, point 4).
 */
export function isAnnouncedNetworkFailure(err: unknown): boolean {
  return (err as { errorCode?: string } | null)?.errorCode === 'NETWORK_UNREACHABLE';
}

/**
 * Message d'échec d'envoi. Pour un 413, le détail du serveur porte la limite réelle
 * (« … dépasse la taille maximale autorisée (X Mo) ») : on le reprend tel quel, sinon
 * un texte sans chiffre.
 */
export function uploadErrorMessage(status: number | undefined, detail?: string): string {
  if (status === 409) return 'Un fichier identique existe déjà dans votre espace. Vérifiez vos doublons avant de réessayer.';
  if (status === 400) return 'Données invalides. Vérifiez le titre et la catégorie.';
  if (status === 413) {
    return detail && /taille maximale/i.test(detail)
      ? detail
      : 'Fichier trop volumineux. Compressez-le ou découpez-le avant de réessayer.';
  }
  return "L'envoi a échoué. Vérifiez votre connexion et réessayez.";
}
