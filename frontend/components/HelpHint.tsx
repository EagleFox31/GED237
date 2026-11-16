import React, { useEffect, useId, useRef, useState } from 'react';

interface HelpHintProps {
  /** Infobulle : une phrase courte à l'impératif. */
  tip: string;
  /** Texte d'aide affiché au clic (deux phrases au plus). */
  children?: React.ReactNode;
  /** Nom accessible du bouton, ex. « Aide sur les doublons ». */
  label: string;
  className?: string;
}

/**
 * Icône d'aide « ? » : infobulle au survol, texte d'aide au clic.
 * À placer dans un coin de carte (`absolute`) ou à côté d'un titre.
 */
export const HelpHint: React.FC<HelpHintProps> = ({ tip, children, label, className = '' }) => {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open]);

  return (
    <span ref={rootRef} className={`relative inline-flex ${className}`}>
      <button
        type="button"
        title={tip}
        aria-label={label}
        aria-expanded={children ? open : undefined}
        aria-controls={children && open ? panelId : undefined}
        onClick={(e) => {
          e.stopPropagation();
          if (children) setOpen((v) => !v);
        }}
        className="flex h-5 w-5 items-center justify-center rounded-full text-slate-400 hover:text-violet-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
      >
        <span className="material-symbols-outlined text-base" aria-hidden="true">help</span>
      </button>
      {children && open && (
        <span
          id={panelId}
          role="note"
          className="absolute right-0 top-6 z-30 w-64 rounded-2xl border border-slate-200 bg-white p-3 text-left text-xs font-normal normal-case tracking-normal text-slate-600 shadow-lg"
        >
          {children}
        </span>
      )}
    </span>
  );
};

export default HelpHint;
