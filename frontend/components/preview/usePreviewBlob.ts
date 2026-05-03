import { useEffect, useState } from 'react';
import { api } from '../../services/api';

interface PreviewBlobState {
  blob: Blob | null;
  blobUrl: string | null;
  loading: boolean;
  error: string | null;
}

/**
 * Charge le contenu binaire d'un document et expose un object URL.
 * Responsabilité unique : fetch + cycle de vie de l'URL (révocation propre).
 *
 * Re-fetch déclenché par changement de `documentId` ou `enabled`.
 */
export function usePreviewBlob(
  documentId: string | null | undefined,
  enabled: boolean,
): PreviewBlobState {
  const [state, setState] = useState<PreviewBlobState>({
    blob: null,
    blobUrl: null,
    loading: false,
    error: null,
  });

  useEffect(() => {
    if (!enabled || !documentId) {
      setState({ blob: null, blobUrl: null, loading: false, error: null });
      return;
    }

    let cancelled = false;
    let createdUrl: string | null = null;

    setState({ blob: null, blobUrl: null, loading: true, error: null });

    api
      .getDocumentContentBlob(documentId, 'inline')
      .then((blob) => {
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        createdUrl = url;
        setState({ blob, blobUrl: url, loading: false, error: null });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          (err as { userMessage?: string; message?: string })?.userMessage
          || (err as { message?: string })?.message
          || 'Aperçu indisponible.';
        setState({ blob: null, blobUrl: null, loading: false, error: message });
      });

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [documentId, enabled]);

  return state;
}
