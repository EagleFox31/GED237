// Bloc « Texte reconnu » de la fiche (#276) : replié par défaut, le texte n'est chargé qu'au dépliage.
import React, { useState } from 'react';
import { api } from '../services/api';
import type { DocumentOcr } from '../services/resources/documents.api';
import { pushClientOperationError } from '../lib/errors/clientOperationError';
import { recognizedTextView } from '../lib/recognizedText';

interface RecognizedTextProps {
  documentId: string;
  uploadedAt?: string;
}

const RecognizedText: React.FC<RecognizedTextProps> = ({ documentId, uploadedAt }) => {
  const [open, setOpen] = useState(false);
  const [ocr, setOcr] = useState<DocumentOcr | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = async () => {
    setLoading(true);
    setFailed(false);
    try {
      setOcr(await api.getDocumentOcr(documentId));
    } catch {
      // Le message d'erreur HTTP est affiché par le bus global.
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && !ocr && !loading) load().catch(() => undefined);
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch (err) {
      pushClientOperationError(err, { fallbackDetail: 'Copie impossible. Sélectionnez le texte à la main.' });
    }
  };

  const view = ocr ? recognizedTextView(ocr, uploadedAt, Date.now()) : null;

  return (
    <section className="glass rounded-3xl border border-slate-100 bg-white/60">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls="recognized-text-panel"
        className="w-full flex items-center justify-between px-5 py-4 text-sm font-bold text-slate-700"
      >
        Texte reconnu
        <span aria-hidden="true" className={`transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>
      {open && (
        <div id="recognized-text-panel" className="px-5 pb-5 space-y-3">
          {loading && (
            <div className="flex justify-center py-4" role="status" aria-label="Chargement du texte reconnu">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-rdpc-blue"></div>
            </div>
          )}
          {!loading && failed && <p className="text-sm text-slate-500">Texte indisponible pour le moment.</p>}
          {!loading && view?.kind === 'message' && <p className="text-sm text-slate-500">{view.message}</p>}
          {!loading && view?.kind === 'text' && (
            <>
              {view.uncertain && <p className="text-xs text-amber-700">Lecture incertaine : vérifiez sur l'original.</p>}
              <pre
                aria-label="Texte reconnu"
                className="whitespace-pre-wrap break-words font-sans text-sm text-slate-700 max-h-64 overflow-y-auto rounded-2xl bg-slate-50 p-4"
              >
                {view.text}
              </pre>
              <div className="flex items-center justify-end gap-3">
                {copied && <span role="status" className="text-xs text-green-700">Texte copié.</span>}
                <button
                  type="button"
                  onClick={() => {
                    copy(view.text).catch(() => undefined);
                  }}
                  className="px-4 py-2 text-xs font-bold text-blue-600 bg-white border border-blue-200 rounded-xl hover:bg-blue-50 transition-colors"
                >
                  Copier
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
};

export default RecognizedText;
