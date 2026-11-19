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

/** Limite par défaut, identique à `MAX_UPLOAD_SIZE` côté API (backend/app/core/config.py). */
export const DEFAULT_MAX_UPLOAD_MB = 100;

/** Limite lue au build (`VITE_MAX_UPLOAD_SIZE_MB`) ; valeur absente ou invalide : défaut. */
export function maxUploadMb(raw: string | undefined): number {
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : DEFAULT_MAX_UPLOAD_MB;
}

const MB = 1024 * 1024;

/** Taille lisible : « 850 Ko », « 12,3 Mo ». */
export function formatFileSize(bytes: number): string {
  if (bytes < MB) return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  return `${(bytes / MB).toFixed(1).replace('.', ',')} Mo`;
}

/** Refus avant envoi d'un fichier au-delà de la limite (même calcul que l'API : Mo = 1024 × 1024 octets). */
export function fileTooLargeMessage(sizeBytes: number, maxMb: number): string | null {
  if (sizeBytes <= maxMb * MB) return null;
  return `Fichier trop volumineux (${formatFileSize(sizeBytes)}). Maximum : ${maxMb} Mo. Compressez-le ou découpez-le.`;
}

/**
 * Avertissement (non bloquant) pour un format que l'application ne sait ni lire
 * (texte cherchable : PDF et images) ni afficher en aperçu.
 */
export function unreadableFormatNotice(mime: string, canPreview: boolean): string | null {
  const type = mime.toLowerCase();
  const readable = type === 'application/pdf' || type.startsWith('image/');
  if (readable || canPreview) return null;
  return 'Ce format sera archivé, mais sans aperçu ni recherche dans son contenu.';
}
