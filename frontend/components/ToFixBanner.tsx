import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { TO_FIX_ROUTE, toFixLabel } from '../lib/toFix';

/**
 * Bandeau d'accueil : « N documents à corriger » (rejetés ou renvoyés), un clic ouvre la liste filtrée.
 * Rien n'est affiché tant qu'il n'y a rien à corriger, ni en cas d'échec de lecture.
 */
export const ToFixBanner: React.FC = () => {
  const navigate = useNavigate();
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.getMyWorkflowCounters()
      .then((counters) => { if (!cancelled) setLabel(toFixLabel(counters)); })
      .catch(() => { /* Compteur d'appoint : l'accueil reste utilisable sans lui. */ });
    return () => { cancelled = true; };
  }, []);

  if (!label) return null;

  return (
    <div className="px-8 pt-6 max-w-[1600px] mx-auto">
      <button
        type="button"
        data-testid="to-fix-banner"
        onClick={() => navigate(TO_FIX_ROUTE)}
        className="w-full flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-left text-red-800 hover:bg-red-100 transition-colors"
      >
        <span className="material-symbols-outlined text-xl" aria-hidden="true">assignment_return</span>
        <span className="text-sm font-bold flex-1">{label}</span>
        <span className="text-xs font-bold uppercase tracking-wide">Voir</span>
        <span className="material-symbols-outlined text-lg" aria-hidden="true">arrow_forward</span>
      </button>
    </div>
  );
};
