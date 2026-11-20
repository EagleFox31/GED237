import React, { useRef, useState } from 'react';
import { DialogFrame } from '../../../../components/ui/DialogFrame';

interface AgentKeyDialogProps {
  sourceName: string;
  agentKey: string;
  /** Stable (useCallback) : la clé quitte la mémoire de l'écran à la fermeture. */
  onClose: () => void;
}

type CopyState = 'idle' | 'copied' | 'failed';

/**
 * Clé d'un agent, montrée une seule fois (création ou nouvelle clé). Elle n'est gardée que dans
 * l'état de ce dialogue : ni stockage local, ni journal ; le serveur n'en garde que l'empreinte.
 */
export const AgentKeyDialog: React.FC<AgentKeyDialogProps> = ({ sourceName, agentKey, onClose }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [copy, setCopy] = useState<CopyState>('idle');

  const handleCopy = async () => {
    try {
      // Absent hors HTTPS (accès par adresse IP du réseau local) : repli sur la sélection.
      if (!navigator.clipboard) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(agentKey);
      setCopy('copied');
    } catch {
      inputRef.current?.select();
      setCopy('failed');
    }
  };

  return (
    <DialogFrame labelledBy="agent-key-title" describedBy="agent-key-help" onClose={onClose} className="max-w-lg">
      <div className="rounded-[2rem] bg-white p-7 shadow-2xl">
        <h2 id="agent-key-title" className="text-xl font-black tracking-tight text-slate-900">
          Clé de l’agent « {sourceName} »
        </h2>
        <p id="agent-key-help" className="mt-2 text-sm text-slate-600">
          À coller dans l’agent du poste. Elle ne sera plus affichée.
        </p>
        <div className="mt-4 flex items-center gap-2 rounded-2xl border-2 border-amber-200 bg-amber-50 p-2">
          <input
            ref={inputRef}
            readOnly
            value={agentKey}
            aria-label="Clé de l’agent"
            onFocus={(event) => event.currentTarget.select()}
            className="min-w-0 flex-1 bg-transparent px-2 font-mono text-sm font-bold text-slate-900 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => void handleCopy()}
            className="flex shrink-0 items-center gap-1 rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold text-white hover:bg-amber-600"
          >
            <span className="material-symbols-outlined text-base" aria-hidden>content_copy</span>
            Copier
          </button>
        </div>
        <p role="status" className="mt-2 min-h-[1.25rem] text-xs font-medium text-slate-600">
          {copy === 'copied' && 'Clé copiée.'}
          {copy === 'failed' && 'Copie impossible : la clé est sélectionnée, copiez-la avec Ctrl+C.'}
        </p>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl bg-slate-900 px-6 py-3 text-xs font-black uppercase tracking-widest text-white hover:bg-rdpc-blue"
          >
            J’ai noté la clé
          </button>
        </div>
      </div>
    </DialogFrame>
  );
};
