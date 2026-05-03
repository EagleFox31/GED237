import React from 'react';
import type { PreviewRenderProps, PreviewStrategy } from '../types';

const ImageRenderer: React.FC<PreviewRenderProps> = ({ blobUrl, filename }) => (
  <img
    src={blobUrl}
    alt={filename}
    className="max-h-full max-w-full rounded-3xl border border-slate-200 bg-white object-contain shadow-sm"
  />
);

export const imageStrategy: PreviewStrategy = {
  id: 'image',
  // SVG explicitement exclu (XSS via JS embarqué dans le SVG).
  canHandle: ({ mime }) => mime.startsWith('image/') && !mime.includes('svg'),
  Renderer: ImageRenderer,
};
