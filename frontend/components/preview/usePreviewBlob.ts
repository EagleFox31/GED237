import { useEffect, useState } from 'react';
import { api } from '../../services/api';

interface PreviewBlobState {
  blob: Blob | null;
  blobUrl: string | null;
  loading: boolean;
  error: string | null;
  /** Octets reçus pendant le chargement. */
  loaded: number;
  /** Taille annoncée par le serveur, ou null. */
  total: number | null;
}

const IDLE: PreviewBlobState = { blob: null, blobUrl: null, loading: false, error: null, loaded: 0, total: null };

/** Une mise à jour d'écran tous les 256 Ko au plus : un gros PDF arrive en milliers de morceaux. */
const PROGRESS_STEP = 256 * 1024;

/**
 * Charge le contenu binaire d'un document et expose un object URL.
 * Responsabilité unique : fetch + cycle de vie de l'URL (révocation propre) + progression.
 *
 * Re-fetch déclenché par changement de `documentId` ou `enabled`.
 */
export function usePreviewBlob(
  documentId: string | null | undefined,
  enabled: boolean,
): PreviewBlobState {
  const [state, setState] = useState<PreviewBlobState>(IDLE);

  useEffect(() => {
    if (!enabled || !documentId) {
      setState(IDLE);
      return;
    }

    let cancelled = false;
    let createdUrl: string | null = null;
    let shown = -PROGRESS_STEP;

    setState({ ...IDLE, loading: true });

    api
      .getDocumentContentBlob(documentId, 'inline', (loaded, total) => {
        if (cancelled || loaded - shown < PROGRESS_STEP) return;
        shown = loaded;
        setState((s) => (s.loading ? { ...s, loaded, total } : s));
      })
      .then((blob) => {
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        createdUrl = url;
        setState({ ...IDLE, blob, blobUrl: url, loaded: blob.size, total: blob.size });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          (err as { userMessage?: string; message?: string })?.userMessage
          || (err as { message?: string })?.message
          || 'Aperçu indisponible.';
        setState({ ...IDLE, error: message });
      });

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [documentId, enabled]);

  return state;
}
