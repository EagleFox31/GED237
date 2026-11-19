import React, { useEffect, useMemo, useState } from 'react';
import type { PreviewRenderProps, PreviewStrategy } from '../types';
import { rowCount, truncatedRowsNotice } from '../previewLimits';
import { listSheets, readSheet, sheetHasTable } from '../xlsxReader';

// Messages pour l'utilisateur : le détail technique de la bibliothèque n'est pas affiché.
const BOOK_UNREADABLE = "Ce classeur ne peut pas être affiché. Téléchargez-le pour l'ouvrir.";
const SHEET_UNREADABLE = "Cet onglet ne peut pas être affiché. Téléchargez le fichier pour l'ouvrir.";
const SHEET_NO_TABLE = 'Cet onglet ne contient pas de tableau à afficher (graphique ou onglet vide).';

const XLSX_MIMES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
];

type XlsxModule = typeof import('xlsx');

interface LoadedWorkbook {
  XLSX: XlsxModule;
  data: ArrayBuffer;
  names: string[];
}

const XlsxRenderer: React.FC<PreviewRenderProps> = ({ blob, filename }) => {
  const [loaded, setLoaded] = useState<LoadedWorkbook | null>(null);
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
        const data = await blob.arrayBuffer();
        // Liste des onglets seulement : leur contenu est lu un par un, à l'affichage.
        const names = listSheets(XLSX, data);
        if (cancelled) return;
        setLoaded({ XLSX, data, names });
        setActiveIndex(0);
      } catch {
        if (cancelled) return;
        setError(BOOK_UNREADABLE);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [blob]);

  // Seul l'onglet affiché est lu puis converti en HTML, à la demande.
  const active = useMemo(() => {
    if (!loaded) return null;
    try {
      const sheet = readSheet(loaded.XLSX, loaded.data, loaded.names[activeIndex] ?? '');
      if (!sheetHasTable(sheet)) return { html: '', notice: null, error: SHEET_NO_TABLE };
      const shown = rowCount(sheet['!ref']);
      const total = rowCount((sheet['!fullref'] as string | undefined) ?? sheet['!ref']);
      return {
        html: loaded.XLSX.utils.sheet_to_html(sheet, { editable: false }),
        notice: truncatedRowsNotice(shown, total),
        error: null,
      };
    } catch {
      return { html: '', notice: null, error: SHEET_UNREADABLE };
    }
  }, [loaded, activeIndex]);

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 text-slate-400">
        <div className="h-10 w-10 rounded-full border-4 border-slate-200 border-t-rdpc-blue animate-spin" />
        <p className="text-xs font-medium">Conversion du classeur Excel…</p>
      </div>
    );
  }

  if (error || !loaded || !active) {
    return (
      <div className="rounded-3xl border border-rose-100 bg-white p-10 shadow-sm max-w-md">
        <span className="material-symbols-outlined mb-4 text-6xl text-rose-300">error</span>
        <p className="text-sm font-bold text-rose-700">{error ?? BOOK_UNREADABLE}</p>
      </div>
    );
  }

  return (
    <div
      className="flex h-full w-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
      aria-label={`Aperçu de ${filename}`}
    >
      {loaded.names.length > 1 && (
        <div className="flex flex-shrink-0 gap-1 overflow-x-auto border-b border-slate-100 bg-slate-50 px-3 py-2">
          {loaded.names.map((name, index) => (
            <button
              key={name}
              type="button"
              onClick={() => setActiveIndex(index)}
              aria-pressed={index === activeIndex}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                index === activeIndex
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:bg-white/60'
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      )}
      {active.notice && (
        <p data-testid="xlsx-truncated" className="flex-shrink-0 border-b border-amber-100 bg-amber-50 px-4 py-1.5 text-left text-xs text-amber-800">
          {active.notice}
        </p>
      )}
      {active.error ? (
        <p className="p-4 text-sm font-bold text-rose-700">{active.error}</p>
      ) : (
        <div
          className="xlsx-preview flex-1 overflow-auto p-4 text-left text-xs text-slate-800"
          dangerouslySetInnerHTML={{ __html: active.html }}
        />
      )}
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
