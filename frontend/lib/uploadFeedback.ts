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
