import React, { useState } from 'react';

import { clearSecurityNotices, readSecurityNotices, securityNoticeText } from './securityNotices';

/** Bandeau après la connexion : l'application d'authentification a changé depuis la dernière fois. */
export const SecurityNoticeBanner: React.FC = () => {
  const [lines, setLines] = useState(() =>
    readSecurityNotices()
      .map((n) => securityNoticeText(n))
      .filter((t): t is string => Boolean(t)),
  );

  if (lines.length === 0) return null;

  const dismiss = () => {
    clearSecurityNotices();
    setLines([]);
  };

  return (
    <div role="status" className="mx-4 mt-3 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <span aria-hidden="true" className="material-symbols-outlined text-[20px] text-amber-600">shield_person</span>
      <div className="flex-1 space-y-1">
        {lines.map((line) => (
          <p key={line} className="font-bold">{line}</p>
        ))}
        <p>Pas vous ? Contactez votre administrateur.</p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Fermer"
        className="rounded-full p-1 text-amber-700 hover:bg-amber-100"
      >
        <span aria-hidden="true" className="material-symbols-outlined text-[18px]">close</span>
      </button>
    </div>
  );
};
