import React from 'react';
import type { PreviewRenderProps, PreviewStrategy } from '../types';

const UnsupportedRenderer: React.FC<PreviewRenderProps> = ({ onDownload }) => (
  <div className="rounded-3xl border border-slate-200 bg-white p-10 shadow-sm max-w-md">
    <span className="material-symbols-outlined mb-4 text-6xl text-slate-300">description</span>
    <p className="text-sm font-bold text-slate-700">Aperçu non disponible pour ce format</p>
    <p className="mt-2 text-xs font-medium text-slate-500">
      Ce format ne peut pas être affiché dans le navigateur (formats anciens
      .doc/.ppt, archives, exécutables…). Téléchargez le fichier pour le
      consulter avec l&apos;application appropriée.
    </p>
    <button
      type="button"
      onClick={onDownload}
      className="mt-6 inline-flex items-center gap-2 rounded-xl bg-rdpc-blue px-5 py-2.5 text-xs font-bold text-white transition-colors hover:bg-blue-700"
    >
      <span className="material-symbols-outlined text-sm">download</span>
      Télécharger
    </button>
  </div>
);

/**
 * Stratégie de dernier recours. Doit toujours être placée en dernier
 * dans le registry car son canHandle renvoie systématiquement true.
 */
export const unsupportedStrategy: PreviewStrategy = {
  id: 'unsupported',
  canHandle: () => true,
  Renderer: UnsupportedRenderer,
};
