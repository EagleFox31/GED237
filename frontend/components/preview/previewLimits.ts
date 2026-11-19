import { formatFileSize } from '../../lib/uploadFeedback';

/**
 * Lignes lues par onglet dans l'aperçu Excel. Au-delà, le navigateur peine à afficher le tableau
 * HTML (des milliers de lignes figent l'onglet) ; le fichier complet reste téléchargeable.
 */
export const PREVIEW_MAX_ROWS = 500;

/** Nombre de lignes d'une plage A1 (« A1:F2000 » → 2000), 0 si absente ou illisible. */
export function rowCount(ref: string | undefined): number {
  const match = ref?.match(/^[A-Z]+(\d+)(?::[A-Z]+(\d+))?$/i);
  if (!match) return 0;
  const first = Number(match[1]);
  const last = Number(match[2] ?? match[1]);
  return last - first + 1;
}

/** Message sous l'onglet tronqué, ou null quand tout est affiché. */
export function truncatedRowsNotice(shown: number, total: number): string | null {
  if (total <= shown) return null;
  return `Aperçu limité aux ${shown} premières lignes sur ${total}. Téléchargez le fichier pour tout voir.`;
}

/**
 * Texte pendant le chargement d'un aperçu : taille reçue, et taille totale quand le serveur
 * l'annonce (Content-Length). Sans octet reçu, le libellé historique.
 */
export function loadingLabel(loaded: number, total: number | null): string {
  if (loaded <= 0) return "Chargement de l'aperçu…";
  if (total && total > 0) {
    return `Chargement du document (${formatFileSize(loaded)} sur ${formatFileSize(total)})…`;
  }
  return `Chargement du document (${formatFileSize(loaded)} reçus)…`;
}

/** Pourcentage entier 0–100, ou null si la taille totale est inconnue. */
export function loadingPercent(loaded: number, total: number | null): number | null {
  if (!total || total <= 0) return null;
  return Math.min(100, Math.max(0, Math.floor((loaded / total) * 100)));
}
