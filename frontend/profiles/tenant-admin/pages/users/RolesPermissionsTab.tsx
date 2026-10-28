// frontend/profiles/tenant-admin/pages/users/RolesPermissionsTab.tsx
//
// Onglet 2 — Rôles & Permissions.
// V2 : matrice read-only des 7 rôles × actions autorisées.
import React from 'react';

const RolesPermissionsTab: React.FC = () => (
  <div className="flex h-full items-center justify-center">
    <div className="rounded-[2.5rem] border-2 border-dashed border-slate-200 bg-white p-12 text-center max-w-md">
      <span className="material-symbols-outlined text-6xl text-slate-300">shield_person</span>
      <h2 className="text-xl font-black uppercase italic tracking-tighter text-slate-800 mt-4">
        Rôles & permissions
      </h2>
      <p className="text-sm text-slate-500 mt-3 leading-relaxed">
        Cet onglet affichera la matrice des 7 rôles (super_admin, tenant_admin,
        unit_admin, manager, collab, reader, auditor) et ce que chacun peut
        faire dans le système.
      </p>
      <p className="text-[11px] text-slate-400 italic mt-4">Sprint B — à venir.</p>
    </div>
  </div>
);

export default RolesPermissionsTab;
