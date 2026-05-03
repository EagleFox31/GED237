import React, { useEffect, useRef, useState } from 'react';
import type { PreviewRenderProps, PreviewStrategy } from '../types';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const DocxRenderer: React.FC<PreviewRenderProps> = ({ blob, filename }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    if (!container) return;

    setLoading(true);
    setError(null);
    container.innerHTML = '';

    (async () => {
      try {
        // Lazy-load : docx-preview n'est téléchargé que si un .docx est rencontré.
        const docx = await import('docx-preview');
        if (cancelled || !containerRef.current) return;
        await docx.renderAsync(blob, containerRef.current, undefined, {
          className: 'docx',
          inWrapper: true,
          // Conserve la mise en page d'origine (largeurs, hauteurs, fontes,
          // pagination) pour une fidélité visuelle proche de Word.
          ignoreWidth: false,
          ignoreHeight: false,
          ignoreFonts: false,
          breakPages: true,
          renderHeaders: true,
          renderFooters: true,
          renderFootnotes: true,
          renderEndnotes: true,
          experimental: true,
          useBase64URL: true,
        });
      } catch (err: unknown) {
        if (cancelled) return;
        const message = (err as { message?: string })?.message
          || 'Conversion du document Word impossible.';
        setError(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [blob]);

  return (
    <div className="relative h-full w-full">
      {loading && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-3xl bg-white/80 text-slate-400 backdrop-blur-sm">
          <div className="h-10 w-10 rounded-full border-4 border-slate-200 border-t-rdpc-blue animate-spin" />
          <p className="text-xs font-medium">Conversion du document Word…</p>
        </div>
      )}
      {error && !loading && (
        <div className="flex h-full items-center justify-center">
          <div className="rounded-3xl border border-rose-100 bg-white p-10 shadow-sm max-w-md text-center">
            <span className="material-symbols-outlined mb-4 text-6xl text-rose-300">error</span>
            <p className="text-sm font-bold text-rose-700">{error}</p>
          </div>
        </div>
      )}
      <div
        ref={containerRef}
        className="docx-preview h-full w-full overflow-auto rounded-3xl border border-slate-200 bg-slate-100 p-6 text-left text-slate-800 shadow-sm"
        role="document"
        aria-label={`Aperçu de ${filename}`}
      />
    </div>
  );
};

export const docxStrategy: PreviewStrategy = {
  id: 'docx',
  canHandle: ({ mime, filename }) =>
    mime === DOCX_MIME
    || mime.includes('wordprocessingml')
    || filename.toLowerCase().endsWith('.docx'),
  Renderer: DocxRenderer,
};
