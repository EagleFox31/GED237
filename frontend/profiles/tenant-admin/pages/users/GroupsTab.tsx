// frontend/profiles/tenant-admin/pages/users/GroupsTab.tsx
//
// Onglet 3 — Groupes.
// V3 : groupes ad-hoc d'agents pour distribuer documents/tâches en bloc.
import React from 'react';

const GroupsTab: React.FC = () => (
  <div className="flex h-full items-center justify-center">
    <div className="rounded-[2.5rem] border-2 border-dashed border-slate-200 bg-white p-12 text-center max-w-md">
      <span className="material-symbols-outlined text-6xl text-slate-300">group</span>
      <h2 className="text-xl font-black uppercase italic tracking-tighter text-slate-800 mt-4">
        Groupes de travail
      </h2>
      <p className="text-sm text-slate-500 mt-3 leading-relaxed">
        Créez des groupes ad-hoc d&apos;agents (ex : « Comité validation marchés »,
        « Cellule réforme ») pour distribuer un document ou une tâche à
        plusieurs personnes en une action.
      </p>
      <p className="text-[11px] text-slate-400 italic mt-4">Sprint C — à venir.</p>
    </div>
  </div>
);

export default GroupsTab;
