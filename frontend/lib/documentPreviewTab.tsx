// frontend/lib/documentPreviewTab.tsx
//
// Logique pure et vue de présentation de l'aperçu intégré d'une fiche document :
// - reconstruit un nom de fichier avec extension via `downloadName` pour que la
//   stratégie d'aperçu (PDF, image, Word, Excel) reconnaisse le format même
//   lorsque `title` est sans extension et `mime_type` absent ;
// - n'active le chargement réseau (`enabled`) que si l'onglet est actif et
//   l'identifiant du document renseigné ;
// - sépare la vue pure (`DocumentPreviewTabView`) du branchement réseau
//   (`DocumentPreview`) pour permettre les tests unitaires de rendu hors navigateur.

import React, { useMemo } from 'react';
import type { Document } from '../types';
import { getFileTypeLabel } from '../types';
import type { DocumentPreviewProps } from '../components/preview/DocumentPreview';
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

export interface DocumentPreviewTabProps {
  document: PreviewableDocument;
  /** Charge le fichier uniquement lorsque l'onglet est visible. */
  enabled?: boolean;
  /** Action de téléchargement fournie par la fiche parente. */
  onDownload?: () => void;
}

export interface DocumentPreviewTabViewProps extends DocumentPreviewTabProps {
  PreviewRenderer: React.ComponentType<DocumentPreviewProps>;
}

export const DocumentPreviewTabView: React.FC<DocumentPreviewTabViewProps> = ({
  document,
  enabled = true,
  onDownload,
  PreviewRenderer,
}) => {
  const preview = useMemo(
    () => resolveDocumentPreviewProps(document, enabled),
    [document, enabled],
  );

  return (
    <div
      data-testid="document-preview-tab"
      className="glass flex h-full min-h-[26rem] flex-col overflow-hidden rounded-3xl border border-white bg-white/70"
    >
      <div className="flex items-center justify-between border-b border-slate-100 bg-white/80 px-6 py-4">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-bold uppercase tracking-widest text-slate-800">
            Aperçu du document
          </h3>
          <span
            data-testid="document-preview-type"
            className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-slate-500"
          >
            {getFileTypeLabel(document.mime_type || document.file_type)}
          </span>
        </div>
        {onDownload && (
          <button
            type="button"
            onClick={onDownload}
            data-testid="document-preview-download"
            className="inline-flex items-center gap-2 rounded-xl bg-rdpc-blue px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-blue-700"
          >
            <span className="material-symbols-outlined text-sm" aria-hidden="true">
              download
            </span>
            Télécharger
          </button>
        )}
      </div>

      {preview.strategyId === 'unsupported' && (
        <p
          data-testid="document-preview-unsupported"
          className="px-6 pt-3 text-xs font-medium text-slate-500"
        >
          {UNSUPPORTED_PREVIEW_MESSAGE}
        </p>
      )}

      <div className="flex-1 overflow-auto bg-slate-100/70 p-4">
        <PreviewRenderer
          documentId={preview.documentId}
          filename={preview.filename}
          mimeType={preview.mimeType}
          enabled={preview.enabled}
          onDownload={onDownload}
          className="flex h-full min-h-[22rem] w-full items-center justify-center text-center"
        />
      </div>
    </div>
  );
};
