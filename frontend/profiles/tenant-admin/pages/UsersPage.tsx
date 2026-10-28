// frontend/profiles/tenant-admin/pages/UsersPage.tsx
//
// Page « Agents & Rôles » — gestion du personnel du tenant.
// Architecture en 3 onglets numérotés (cohérent avec ClassementPage / GEDRulesPage) :
//   1. Liste des agents (V1)
//   2. Rôles & Permissions (V2)
//   3. Groupes (V3)
//
// SRP : UsersPage = orchestrateur (titre + nav onglets). Chaque onglet est
// un composant autonome qui charge ses propres données.
import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import AgentsListTab from './users/AgentsListTab';
import RolesPermissionsTab from './users/RolesPermissionsTab';
import GroupsTab from './users/GroupsTab';

interface UsersNavState {
  agentId?: string;
  action?: 'create';
  from?: string;
}

type UsersTab = 'agents' | 'roles' | 'groups';

const TAB_META: Record<UsersTab, { label: string; icon: string; accent: string; step: number }> = {
  agents: { label: 'Liste des agents', icon: 'badge', accent: 'text-rdpc-blue', step: 1 },
  roles: { label: 'Rôles & permissions', icon: 'shield_person', accent: 'text-emerald-600', step: 2 },
  groups: { label: 'Groupes', icon: 'group', accent: 'text-violet-600', step: 3 },
};

const TAB_ORDER: UsersTab[] = ['agents', 'roles', 'groups'];

const UsersPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<UsersTab>('agents');
  const location = useLocation();
  // location.state n'est pas typé strictement par React Router → cast prudent.
  const navState = (location.state || {}) as UsersNavState;
  // Si on arrive depuis Structure Hiérarchique avec un agentId ou une demande
  // de création, on force l'onglet 1 — sinon on respecte la sélection courante.
  useEffect(() => {
    if (navState.agentId || navState.action === 'create') {
      setActiveTab('agents');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navState.agentId, navState.action]);

  return (
    <div className="p-8 pb-8 flex flex-col h-full min-h-0 animate-in fade-in duration-500">
      <div className="flex justify-between items-center mb-8 shrink-0">
        <div>
          <h1 className="text-4xl font-black text-slate-800 tracking-tighter uppercase italic flex items-center gap-3">
            <span className="material-symbols-outlined text-4xl text-rdpc-blue">group</span>
            Agents & Rôles
          </h1>
          <p className="text-slate-500 font-medium italic mt-2">
            Pilotez les comptes des agents du ministère, leurs rôles, leurs groupes de travail.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-6 h-full min-h-0">
        <div className="flex gap-2.5 border-b-2 border-slate-200 shrink-0 overflow-x-auto custom-scrollbar">
          {TAB_ORDER.map((tab) => {
            const meta = TAB_META[tab];
            const isActive = activeTab === tab;
            return (
              <button
                type="button"
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-4 px-4 text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2.5 whitespace-nowrap ${isActive ? 'text-rdpc-blue border-b-4 border-rdpc-blue mb-[-2px]' : 'text-slate-400 hover:text-slate-700 hover:border-slate-300'}`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${isActive ? 'bg-rdpc-blue text-white' : 'bg-slate-100 text-slate-500'}`}>{meta.step}</span>
                <span className={`material-symbols-outlined text-base ${meta.accent}`}>{meta.icon}</span>
                {meta.label}
              </button>
            );
          })}
        </div>

        <div className="flex-1 min-h-0 overflow-hidden">
          {activeTab === 'agents' && (
            <AgentsListTab
              initialAgentId={navState.agentId}
              initialAction={navState.action}
              from={navState.from}
            />
          )}
          {activeTab === 'roles' && <RolesPermissionsTab />}
          {activeTab === 'groups' && <GroupsTab />}
        </div>
      </div>
    </div>
  );
};

export default UsersPage;
