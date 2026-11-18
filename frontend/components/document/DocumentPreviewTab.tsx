// frontend/components/document/DocumentPreviewTab.tsx
import React, { useMemo } from 'react';
import { getFileTypeLabel } from '../../types';
import { DocumentPreview } from '../preview';
import {
  UNSUPPORTED_PREVIEW_MESSAGE,
  resolveDocumentPreviewProps,
  type PreviewableDocument,
} from '../../lib/documentPreviewTab';

export {
  UNSUPPORTED_PREVIEW_MESSAGE,
  resolveDocumentPreviewProps,
  type PreviewableDocument,
};

export interface DocumentPreviewTabProps {
  document: PreviewableDocument;
  /** Charge le fichier uniquement lorsque l'onglet est visible. */
  enabled?: boolean;
  /** Action de téléchargement fournie par la fiche parente. */
  onDownload?: () => void;
}

export const DocumentPreviewTab: React.FC<DocumentPreviewTabProps> = ({
  document,
  enabled = true,
  onDownload,
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
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-slate-500">
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
        <p className="px-6 pt-3 text-xs font-medium text-slate-500">
          {UNSUPPORTED_PREVIEW_MESSAGE}
        </p>
      )}

      <div className="flex-1 overflow-auto bg-slate-100/70 p-4">
        <DocumentPreview
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

export default DocumentPreviewTab;
