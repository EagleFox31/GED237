// Ce que montre le bloc « Texte reconnu » de la fiche, d'après GET /documents/{id}/ocr (#276).
import type { DocumentOcr } from '../services/resources/documents.api';

/**
 * Anciens documents seulement : avant l'état `failed`, une lecture ratée restait `processing`.
 * Passé ce délai après le dépôt, on la traite comme un échec sans raison.
 */
export const READING_GIVE_UP_MS = 24 * 60 * 60 * 1000;

export type RecognizedTextView =
  | { kind: 'text'; text: string; uncertain: boolean }
  | { kind: 'message'; message: string };

export const RECOGNIZED_TEXT_MESSAGES = {
  processing: 'Lecture du texte en cours. Revenez dans quelques minutes.',
  notProcessed: 'Pas de texte reconnu pour ce type de fichier.',
  empty: "Aucun texte lisible n'a été trouvé dans ce fichier.",
  failed: "Le texte n'a pas pu être lu.",
} as const;

/** Message par raison d'échec (`ocr_error`) : le texte technique du serveur n'est jamais affiché. */
export const FAILED_MESSAGES: Readonly<Record<string, string>> = {
  file_not_found: "Le texte n'a pas pu être lu : le fichier est introuvable. Prévenez votre administrateur.",
  unsupported_format: 'Ce type de fichier ne permet pas de lire le texte.',
  no_text: RECOGNIZED_TEXT_MESSAGES.empty,
  engine_error: 'La lecture du texte a échoué. Réessayez plus tard ou prévenez votre administrateur.',
};

const failedMessage = (reason: string | null | undefined): string =>
  (reason && FAILED_MESSAGES[reason]) || RECOGNIZED_TEXT_MESSAGES.failed;

export function recognizedTextView(ocr: DocumentOcr, uploadedAt: string | undefined, now: number): RecognizedTextView {
  switch (ocr.ocr_status) {
    case 'completed': {
      const text = ocr.ocr_content?.trim() ?? '';
      if (!text) return { kind: 'message', message: RECOGNIZED_TEXT_MESSAGES.empty };
      return { kind: 'text', text, uncertain: ocr.low_confidence === true };
    }
    case 'failed':
      return { kind: 'message', message: failedMessage(ocr.ocr_error) };
    case 'processing': {
      const uploaded = uploadedAt ? Date.parse(uploadedAt) : Number.NaN;
      const givenUp = Number.isFinite(uploaded) && now - uploaded > READING_GIVE_UP_MS;
      return { kind: 'message', message: givenUp ? RECOGNIZED_TEXT_MESSAGES.failed : RECOGNIZED_TEXT_MESSAGES.processing };
    }
    default:
      return { kind: 'message', message: RECOGNIZED_TEXT_MESSAGES.notProcessed };
  }
}
