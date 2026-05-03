import React, { useCallback, useMemo } from 'react';
import { api } from '../../services/api';
import { resolvePreviewStrategy } from './PreviewStrategyRegistry';
import { usePreviewBlob } from './usePreviewBlob';
import { unsupportedStrategy } from './strategies/UnsupportedStrategy';

export interface DocumentPreviewProps {
  documentId: string;
  filename: string;
  mimeType?: string | null;
  /** Désactive le fetch (ex: panel fermé). */
  enabled?: boolean;
  /** Callback optionnel : si fourni, prime sur le download natif. */
  onDownload?: () => void;
  className?: string;
}

/**
 * Façade unique d'aperçu de document.
 * Sélectionne la stratégie adaptée au format puis délègue le rendu.
 *
 * SRP : orchestration uniquement (pas de rendu format-spécifique ici).
 * OCP : ajouter un format = ajouter une stratégie dans le registry.
 * DIP : dépend de l'interface PreviewStrategy, pas des implémentations.
 */
export const DocumentPreview: React.FC<DocumentPreviewProps> = ({
  documentId,
  filename,
  mimeType,
  enabled = true,
  onDownload,
  className,
}) => {
  const source = useMemo(
    () => ({
      mime: (mimeType || '').toLowerCase(),
      filename,
    }),
    [mimeType, filename],
  );

  const strategy = useMemo(() => resolvePreviewStrategy(source), [source]);

  // Pas besoin de télécharger le blob si la stratégie est "unsupported"
  // (elle n'utilise que le bouton download).
  const needsBlob = enabled && strategy.id !== unsupportedStrategy.id;
  const { blob, blobUrl, loading, error } = usePreviewBlob(documentId, needsBlob);

  const handleDownload = useCallback(async () => {
    if (onDownload) {
      onDownload();
      return;
    }
    try {
      const downloadBlob = await api.getDocumentContentBlob(documentId, 'attachment');
      const url = URL.createObjectURL(downloadBlob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = filename || 'document';
      window.document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1_000);
    } catch {
      /* erreur déjà publiée par apiCallBlob */
    }
  }, [documentId, filename, onDownload]);

  const wrapperClass = className
    ?? 'flex h-full w-full items-center justify-center text-center';

  if (loading) {
    return (
      <div className={wrapperClass}>
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <div className="h-10 w-10 rounded-full border-4 border-slate-200 border-t-rdpc-blue animate-spin" />
          <p className="text-xs font-medium">Chargement de l&apos;aperçu…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={wrapperClass}>
        <div className="rounded-3xl border border-rose-100 bg-white p-10 shadow-sm max-w-md">
          <span className="material-symbols-outlined mb-4 text-6xl text-rose-300">error</span>
          <p className="text-sm font-bold text-rose-700">{error}</p>
          <button
            type="button"
            onClick={handleDownload}
            className="mt-6 rounded-xl bg-slate-100 px-5 py-2.5 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-200"
          >
            Télécharger le fichier
          </button>
        </div>
      </div>
    );
  }

  // Cas "unsupported" : pas de blob requis, on rend directement la stratégie
  // de fallback avec un blob vide pour respecter le contrat.
  if (strategy.id === unsupportedStrategy.id) {
    const { Renderer } = strategy;
    return (
      <div className={wrapperClass}>
        <Renderer
          blob={new Blob()}
          blobUrl=""
          filename={filename}
          onDownload={handleDownload}
        />
      </div>
    );
  }

  if (!blob || !blobUrl) {
    return null;
  }

  const { Renderer } = strategy;
  return (
    <div className={wrapperClass}>
      <Renderer
        blob={blob}
        blobUrl={blobUrl}
        filename={filename}
        onDownload={handleDownload}
      />
    </div>
  );
};
