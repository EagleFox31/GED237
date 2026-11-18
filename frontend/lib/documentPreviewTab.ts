// frontend/lib/documentPreviewTab.ts
//
// Logique pure de préparation de l'aperçu intégré d'une fiche document :
// - reconstruit un nom de fichier avec extension via `downloadName` pour que la
//   stratégie d'aperçu (PDF, image, Word, Excel) reconnaisse le format même
//   lorsque `title` est sans extension et `mime_type` absent ;
// - n'active le chargement réseau (`enabled`) que si l'onglet est actif et
//   l'identifiant du document renseigné.

import type { Document } from '../types';
import { resolvePreviewStrategy } from '../components/preview/PreviewStrategyRegistry';
import { downloadName } from './downloadName';

export const UNSUPPORTED_PREVIEW_MESSAGE =
  'Aperçu indisponible pour ce type de fichier : téléchargez-le.';

export type PreviewableDocument = Pick<
  Document,
  'id' | 'title' | 'file_type' | 'file_path' | 'mime_type'
>;

export interface ResolvedDocumentPreview {
  documentId: string;
  filename: string;
  mimeType: string | null;
  enabled: boolean;
  strategyId: string;
}

export const resolveDocumentPreviewProps = (
  document: PreviewableDocument,
  enabled = true,
): ResolvedDocumentPreview => {
  const documentId = (document.id ?? '').trim();
  const filename = downloadName(document);
  const rawMime = (document.mime_type ?? '').trim();
  const rawType = (document.file_type ?? '').trim();
  const mimeType = rawMime || rawType || null;
  const isEnabled = Boolean(enabled && documentId);
  const strategy = resolvePreviewStrategy({
    mime: (mimeType ?? '').toLowerCase(),
    filename,
  });

  return {
    documentId,
    filename,
    mimeType,
    enabled: isEnabled,
    strategyId: strategy.id,
  };
};
