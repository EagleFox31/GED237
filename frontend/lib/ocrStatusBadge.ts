// frontend/lib/ocrStatusBadge.ts
export type DocumentOcrStatus = 'not_processed' | 'processing' | 'completed' | 'failed';

export interface OcrStatusBadge {
  label: string;
  tone: 'processing' | 'failed';
}

export function resolveOcrStatusBadge(
  status?: DocumentOcrStatus | string | null,
): OcrStatusBadge | null {
  if (status === 'processing') {
    return { label: 'Lecture du texte en cours', tone: 'processing' };
  }
  if (status === 'failed') {
    return { label: 'Texte non lu', tone: 'failed' };
  }
  return null;
}
