// frontend/lib/importErrorMessage.ts
import { errorMessage } from '../utils/errors';

export interface ReadableImportError {
  message: string;
  technicalDetail: string;
}

/**
 * Traduit une erreur technique d'analyse ou d'import en une phrase courte avec conseil,
 * tout en conservant le détail technique pour l'infobulle.
 */
export function formatImportError(
  err: unknown,
  fallbackLabel: string,
): ReadableImportError {
  const technicalDetail = errorMessage(err, fallbackLabel);
  const lower = technicalDetail.toLowerCase();
  const status = typeof err === 'object' && err !== null && 'status' in err
    ? Number((err as { status?: unknown }).status)
    : undefined;

  if (status === 409 || /duplic|doublon|déjà|existe/i.test(lower)) {
    return {
      message: 'Ce document existe déjà.',
      technicalDetail,
    };
  }
  if (status === 413 || /too large|trop volumineux|size|taille|max/i.test(lower)) {
    return {
      message: 'Fichier trop volumineux : réduisez sa taille puis réessayez.',
      technicalDetail,
    };
  }
  if (/unreadable|corrupt|password|protected|encrypted|illisible|chiffr|protégé|pdf/i.test(lower)) {
    return {
      message: "Fichier illisible : vérifiez qu'il n'est pas protégé ou corrompu.",
      technicalDetail,
    };
  }
  if (status === 403 || /forbidden|permission|autorisé|interdit/i.test(lower)) {
    return {
      message: "Action non autorisée sur ce dossier : vérifiez vos droits d'import.",
      technicalDetail,
    };
  }
  if (/network|timeout|fetch|connexion|réseau|econn/i.test(lower)) {
    return {
      message: 'Connexion interrompue : vérifiez votre réseau et relancez.',
      technicalDetail,
    };
  }

  return {
    message: `${fallbackLabel} Vérifiez les fichiers sélectionnés puis réessayez.`,
    technicalDetail,
  };
}
