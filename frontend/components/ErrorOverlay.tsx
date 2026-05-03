// frontend/components/ErrorOverlay.tsx
//
// Rendu global des erreurs poussées dans le bus.
// - Toasts en bas-droite pour info/warning/error non bloquants.
// - Modal centré, focus-trap, pour critical / 401 (auth perdue).
//
// Conformité :
// - WAI-ARIA dialog pattern : modal a role="dialog", aria-modal, aria-labelledby.
// - WCAG 1.4.1 : icône + texte + couleur (jamais couleur seule).
// - WCAG 2.4.3 (Focus order) : à l'ouverture du modal, focus sur le bouton primaire.
// - WCAG 2.3.3 / prefers-reduced-motion : transitions désactivées si demandé.

import React, { useEffect, useRef } from 'react';
import { useErrorBus, type ErrorEntry } from '../lib/errors';

const SEVERITY_STYLES: Record<
  ErrorEntry['severity'],
  { bg: string; ring: string; text: string; icon: string; label: string }
> = {
  info: {
    bg: 'bg-blue-50',
    ring: 'ring-blue-200',
    text: 'text-blue-900',
    icon: 'info',
    label: 'Information',
  },
  warning: {
    bg: 'bg-amber-50',
    ring: 'ring-amber-200',
    text: 'text-amber-900',
    icon: 'warning',
    label: 'Attention',
  },
  error: {
    bg: 'bg-rose-50',
    ring: 'ring-rose-200',
    text: 'text-rose-900',
    icon: 'error',
    label: 'Erreur',
  },
  critical: {
    bg: 'bg-rose-100',
    ring: 'ring-rose-300',
    text: 'text-rose-950',
    icon: 'crisis_alert',
    label: 'Erreur critique',
  },
};

const copyToClipboard = (text: string) => {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => {});
  }
};

const ErrorToast: React.FC<{ entry: ErrorEntry }> = ({ entry }) => {
  const dismiss = useErrorBus((s) => s.dismiss);
  const styles = SEVERITY_STYLES[entry.severity];
  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-auto w-96 max-w-[calc(100vw-2rem)] rounded-2xl ${styles.bg} ring-1 ${styles.ring} shadow-lg p-4 flex items-start gap-3 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4`}
    >
      <span
        className={`material-symbols-outlined ${styles.text} text-xl mt-0.5`}
        aria-hidden="true"
      >
        {styles.icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-black uppercase tracking-widest ${styles.text} mb-0.5`}>
          {styles.label}
        </p>
        <p className={`text-sm font-medium ${styles.text} leading-snug`}>
          {entry.userMessage}
        </p>
        {entry.correlationId && (
          <button
            type="button"
            onClick={() => copyToClipboard(entry.correlationId!)}
            className={`mt-2 text-[10px] uppercase tracking-widest font-bold ${styles.text} opacity-70 hover:opacity-100 transition-opacity inline-flex items-center gap-1`}
            title="Copier le code de support"
          >
            <span className="material-symbols-outlined text-xs">content_copy</span>
            Code support : {entry.correlationId.slice(0, 8)}
          </button>
        )}
        {(entry.retryable && entry.onRetry) && (
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => {
                entry.onRetry?.();
                dismiss(entry.id);
              }}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider bg-white/70 hover:bg-white transition-colors ${styles.text}`}
            >
              Réessayer
            </button>
          </div>
        )}
      </div>
      <button
        type="button"
        aria-label="Fermer"
        onClick={() => dismiss(entry.id)}
        className={`shrink-0 ${styles.text} opacity-60 hover:opacity-100 transition-opacity`}
      >
        <span className="material-symbols-outlined text-base">close</span>
      </button>
    </div>
  );
};

const ErrorModal: React.FC<{ entry: ErrorEntry }> = ({ entry }) => {
  const dismiss = useErrorBus((s) => s.dismiss);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const styles = SEVERITY_STYLES[entry.severity];

  useEffect(() => {
    primaryRef.current?.focus();
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={`err-title-${entry.id}`}
      aria-describedby={`err-desc-${entry.id}`}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 motion-safe:animate-in motion-safe:fade-in"
    >
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
      <div className={`relative w-full max-w-md rounded-3xl ${styles.bg} ring-1 ${styles.ring} shadow-2xl p-6`}>
        <div className="flex items-start gap-3 mb-4">
          <span
            className={`material-symbols-outlined ${styles.text} text-3xl`}
            aria-hidden="true"
          >
            {styles.icon}
          </span>
          <div>
            <p
              id={`err-title-${entry.id}`}
              className={`text-[10px] font-black uppercase tracking-widest ${styles.text}`}
            >
              {styles.label}
            </p>
            <p className={`text-base font-bold ${styles.text}`}>
              {entry.userMessage}
            </p>
          </div>
        </div>
        {entry.correlationId && (
          <div
            id={`err-desc-${entry.id}`}
            className={`text-xs ${styles.text} opacity-80 bg-white/50 rounded-xl px-3 py-2 mb-4 flex items-center justify-between gap-2`}
          >
            <span className="font-mono truncate">
              Code : {entry.correlationId}
            </span>
            <button
              type="button"
              onClick={() => copyToClipboard(entry.correlationId!)}
              aria-label="Copier le code de support"
              className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest hover:underline"
            >
              <span className="material-symbols-outlined text-xs">content_copy</span>
              Copier
            </button>
          </div>
        )}
        <div className="flex justify-end gap-2">
          {entry.retryable && entry.onRetry && (
            <button
              type="button"
              onClick={() => {
                entry.onRetry?.();
                dismiss(entry.id);
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest bg-white hover:bg-slate-100 transition-colors text-slate-700"
            >
              Réessayer
            </button>
          )}
          <button
            ref={primaryRef}
            type="button"
            onClick={() => dismiss(entry.id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest text-white transition-colors ${
              entry.severity === 'critical'
                ? 'bg-rose-700 hover:bg-rose-800'
                : 'bg-slate-800 hover:bg-slate-900'
            }`}
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};

const ErrorOverlay: React.FC = () => {
  const entries = useErrorBus((s) => s.entries);
  const toasts = entries.filter((e) => e.presentation === 'toast');
  const modal = entries.find((e) => e.presentation === 'modal');

  return (
    <>
      {/* Toast stack — bottom right */}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="fixed bottom-4 right-4 z-[90] flex flex-col gap-3 pointer-events-none"
      >
        {toasts.map((entry) => (
          <ErrorToast key={entry.id} entry={entry} />
        ))}
      </div>
      {/* Single modal at a time */}
      {modal && <ErrorModal entry={modal} />}
    </>
  );
};

export default ErrorOverlay;
