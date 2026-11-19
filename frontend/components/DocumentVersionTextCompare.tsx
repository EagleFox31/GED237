import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { diffText, extractPdfText, textDiffSummary, type TextDiffLine } from '../lib/versionTextDiff';
import type { VersionInfo } from '../lib/versionCompare';

interface Props {
  documentId: string;
  before: VersionInfo & { id: string };
  after: VersionInfo & { id: string };
}

type State =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'unsupported' }
  | { status: 'text'; lines: TextDiffLine[] }
  | { status: 'visual'; urls: [string, string]; images: boolean };

const isPdf = (mime?: string | null): boolean => mime === 'application/pdf';
const isText = (mime?: string | null): boolean => !!mime && mime.startsWith('text/');

const readText = async (blob: Blob, mime?: string | null): Promise<string | null> => {
  if (isText(mime)) return blob.text();
  if (isPdf(mime)) return extractPdfText(await blob.arrayBuffer());
  return null;
};

/** Texte qui a changé entre deux versions ; pour un scan (sans texte), les deux fichiers côte à côte. */
const DocumentVersionTextCompare: React.FC<Props> = ({ documentId, before, after }) => {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    const urls: string[] = [];
    setState({ status: 'loading' });
    (async () => {
      try {
        const [a, b] = await Promise.all([
          api.getDocumentVersionContentBlob(documentId, before.id),
          api.getDocumentVersionContentBlob(documentId, after.id),
        ]);
        const [ta, tb] = await Promise.all([readText(a, before.mime_type), readText(b, after.mime_type)]);
        if (cancelled) return;
        if (ta !== null && tb !== null && (ta.trim() || tb.trim())) {
          setState({ status: 'text', lines: await diffText(ta, tb) });
          return;
        }
        const viewable = (m?: string | null) => isPdf(m) || !!m?.startsWith('image/');
        if (viewable(before.mime_type) && viewable(after.mime_type)) {
          const pair: [string, string] = [URL.createObjectURL(a), URL.createObjectURL(b)];
          urls.push(...pair);
          setState({ status: 'visual', urls: pair, images: !!before.mime_type?.startsWith('image/') });
          return;
        }
        setState({ status: 'unsupported' });
      } catch {
        if (!cancelled) setState({ status: 'error' });
      }
    })();
    return () => {
      cancelled = true;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [documentId, before.id, after.id, before.mime_type, after.mime_type]);

  if (state.status === 'loading') return <p data-testid="version-text-status" className="text-xs text-slate-500">Lecture du texte des deux versions…</p>;
  if (state.status === 'error') return <p data-testid="version-text-status" className="text-xs text-red-600">Impossible de lire une des deux versions.</p>;
  if (state.status === 'unsupported') return <p data-testid="version-text-status" className="text-xs text-slate-500">Ce type de fichier ne peut pas être comparé ligne à ligne.</p>;

  if (state.status === 'visual') {
    return (
      <div data-testid="version-visual" className="space-y-1">
        <p className="text-xs text-slate-500">Ce fichier est une image : voici les deux versions côte à côte.</p>
        <div className="grid grid-cols-2 gap-2">
          {state.urls.map((url, i) => (state.images
            ? <img key={url} src={url} alt={`Version ${i === 0 ? before.version_number : after.version_number}`} className="w-full border rounded" />
            : <iframe key={url} src={url} title={`Version ${i === 0 ? before.version_number : after.version_number}`} className="w-full h-96 border rounded" />))}
        </div>
      </div>
    );
  }

  return (
    <div data-testid="version-text" className="space-y-1">
      <p data-testid="version-text-summary" className="text-xs font-semibold text-slate-700">{textDiffSummary(state.lines)}</p>
      <ul className="max-h-72 overflow-auto rounded border border-slate-200 bg-white text-xs font-mono">
        {state.lines.map((line, i) => (
          <li
            // eslint-disable-next-line react/no-array-index-key
            key={`${i}-${line.kind}`}
            data-kind={line.kind}
            className={`px-2 py-0.5 whitespace-pre-wrap break-words ${
              line.kind === 'added' ? 'bg-emerald-50 text-emerald-800' : line.kind === 'removed' ? 'bg-red-50 text-red-800 line-through' : 'text-slate-500'
            }`}
          >
            <span aria-hidden="true">{line.kind === 'added' ? '+ ' : line.kind === 'removed' ? '− ' : '  '}</span>
            <span className="sr-only">{line.kind === 'added' ? 'Ajoutée : ' : line.kind === 'removed' ? 'Retirée : ' : ''}</span>
            {line.text || ' '}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default DocumentVersionTextCompare;
