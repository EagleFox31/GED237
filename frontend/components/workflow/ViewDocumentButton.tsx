import React, { useState } from 'react';

import { api } from '../../services/api';
import type { Document } from '../../types';
import DocumentDetailModal from '../DocumentDetailModal';

interface ViewDocumentButtonProps {
  documentId: string;
  className?: string;
  approveLabel?: string;
  onApprove?: (detailVersionId?: string | null) => void;
  onReject?: (detailVersionId?: string | null) => void;
  decisionDisabled?: boolean;
}

/**
 * « Voir le document » : ouvre la fiche (aperçu, historique) avant de décider, pour ne pas valider à l'aveugle.
 * Les erreurs HTTP de lecture passent par le bus global.
 */
export const ViewDocumentButton: React.FC<ViewDocumentButtonProps> = ({
  documentId,
  className,
  approveLabel,
  onApprove,
  onReject,
  decisionDisabled,
}) => {
  const [document, setDocument] = useState<Document | null>(null);
  const [loading, setLoading] = useState(false);

  const open = async () => {
    setLoading(true);
    try {
      setDocument(await api.getDocument(documentId));
    } catch {
      // Message déjà publié par le client HTTP.
    } finally {
      setLoading(false);
    }
  };

  const taskDecision =
    onApprove && onReject
      ? {
          approveLabel: approveLabel || 'Valider',
          onApprove,
          onReject,
          disabled: decisionDisabled,
        }
      : undefined;

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          void open();
        }}
        disabled={loading}
        className={
          className ??
          'inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-rdpc-blue hover:underline disabled:opacity-50'
        }
      >
        <span className="material-symbols-outlined text-sm" aria-hidden="true">visibility</span>
        {loading ? 'Ouverture…' : 'Voir le document'}
      </button>
      {document && (
        <DocumentDetailModal
          document={document}
          onClose={() => setDocument(null)}
          taskDecision={taskDecision}
        />
      )}
    </>
  );
};
