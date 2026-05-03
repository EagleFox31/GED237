import React, { useEffect, useState } from 'react';
import type { PreviewRenderProps, PreviewStrategy } from '../types';

const XLSX_MIMES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
];

interface SheetView {
  name: string;
  html: string;
}

const XlsxRenderer: React.FC<PreviewRenderProps> = ({ blob, filename }) => {
  const [sheets, setSheets] = useState<SheetView[] | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const XLSX = await import('xlsx');
        const arrayBuffer = await blob.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const views: SheetView[] = workbook.SheetNames
          .filter((name) => Boolean(workbook.Sheets[name]))
          .map((name) => ({
            name,
            html: XLSX.utils.sheet_to_html(workbook.Sheets[name]!, { editable: false }),
          }));
        if (cancelled) return;
        setSheets(views);
        setActiveIndex(0);
      } catch (err: unknown) {
        if (cancelled) return;
        const message = (err as { message?: string })?.message
          || 'Conversion du classeur Excel impossible.';
        setError(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [blob]);

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 text-slate-400">
        <div className="h-10 w-10 rounded-full border-4 border-slate-200 border-t-rdpc-blue animate-spin" />
        <p className="text-xs font-medium">Conversion du classeur Excel…</p>
      </div>
    );
  }

  if (error || !sheets) {
    return (
      <div className="rounded-3xl border border-rose-100 bg-white p-10 shadow-sm max-w-md">
        <span className="material-symbols-outlined mb-4 text-6xl text-rose-300">error</span>
        <p className="text-sm font-bold text-rose-700">{error ?? 'Classeur illisible.'}</p>
      </div>
    );
  }

  return (
    <div
      className="flex h-full w-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
      aria-label={`Aperçu de ${filename}`}
    >
      {sheets.length > 1 && (
        <div className="flex flex-shrink-0 gap-1 overflow-x-auto border-b border-slate-100 bg-slate-50 px-3 py-2">
          {sheets.map((sheet, index) => (
            <button
              key={sheet.name}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                index === activeIndex
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:bg-white/60'
              }`}
            >
              {sheet.name}
            </button>
          ))}
        </div>
      )}
      <div
        className="xlsx-preview flex-1 overflow-auto p-4 text-left text-xs text-slate-800"
        dangerouslySetInnerHTML={{ __html: sheets[activeIndex]?.html ?? '' }}
      />
    </div>
  );
};

export const xlsxStrategy: PreviewStrategy = {
  id: 'xlsx',
  canHandle: ({ mime, filename }) => {
    if (XLSX_MIMES.some((m) => mime.includes(m))) return true;
    const lower = filename.toLowerCase();
    return lower.endsWith('.xlsx') || lower.endsWith('.xls');
  },
  Renderer: XlsxRenderer,
};
