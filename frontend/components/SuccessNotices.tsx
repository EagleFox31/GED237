import React from 'react';
import { useSuccessNotices } from '../lib/successNotice';

/** Confirmations vertes (lib/successNotice), en bas au centre pour ne pas couvrir les erreurs (bas-droite). */
export const SuccessNotices: React.FC = () => {
  const notices = useSuccessNotices((s) => s.notices);
  const dismiss = useSuccessNotices((s) => s.dismiss);
  if (notices.length === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4">
      {notices.map((notice) => (
        <div
          key={notice.id}
          role="status"
          aria-live="polite"
          data-testid="success-notice"
          className="pointer-events-auto flex w-96 max-w-full items-center gap-3 rounded-2xl bg-emerald-50 p-4 text-emerald-900 shadow-lg ring-1 ring-emerald-200 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4"
        >
          <span className="material-symbols-outlined text-xl" aria-hidden="true">check_circle</span>
          <p className="flex-1 text-sm font-semibold leading-snug">{notice.message}</p>
          <button
            type="button"
            aria-label="Fermer"
            onClick={() => dismiss(notice.id)}
            className="shrink-0 opacity-60 transition-opacity hover:opacity-100"
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">close</span>
          </button>
        </div>
      ))}
    </div>
  );
};
