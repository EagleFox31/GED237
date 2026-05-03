import React from 'react';
import type { PreviewRenderProps, PreviewStrategy } from '../types';

const PdfRenderer: React.FC<PreviewRenderProps> = ({ blobUrl, filename }) => (
  <iframe
    src={blobUrl}
    title={`Aperçu de ${filename}`}
    sandbox="allow-same-origin allow-scripts"
    referrerPolicy="no-referrer"
    className="h-full w-full rounded-3xl border border-slate-200 bg-white shadow-sm"
  />
);

export const pdfStrategy: PreviewStrategy = {
  id: 'pdf',
  canHandle: ({ mime, filename }) =>
    mime.includes('pdf') || filename.toLowerCase().endsWith('.pdf'),
  Renderer: PdfRenderer,
};
