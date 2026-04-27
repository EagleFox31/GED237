import React, { useEffect } from 'react';
import type { OrgUnitNode, TenantUser } from './types';
import { ROLE_LABELS, ROLE_BADGE_STYLES } from './constants';
import { Avatar } from './Avatar';

interface OrgUnitDrawerProps {
  node: OrgUnitNode;
  parent?: OrgUnitNode | null;
  users: TenantUser[];
  onClose: () => void;
  onAddChild: (node: OrgUnitNode) => void;
  onAddUser: (node: OrgUnitNode) => void;
}

export const OrgUnitDrawer: React.FC<OrgUnitDrawerProps> = ({ node, parent, users, onClose, onAddChild, onAddUser }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const directUsers = users.filter((u) => u.org_unit_id === node.id);

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="orgunit-drawer-title"
        className="relative w-full max-w-md bg-white shadow-2xl h-full overflow-y-auto animate-in slide-in-from-right duration-300"
      >
        <header className="sticky top-0 bg-white border-b border-slate-100 px-6 py-5 flex items-start gap-3 z-10">
          <div className="w-10 h-10 rounded-xl bg-rdpc-blue/10 text-rdpc-blue flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined">account_tree</span>
          </div>
          <div className="flex-1 min-w-0">
            <h3 id="orgunit-drawer-title" className="text-xl font-black italic uppercase text-slate-900 tracking-tighter truncate">
              {node.name}
            </h3>
            <p className="text-[10px] text-slate-400 font-mono uppercase tracking-wider mt-0.5">
              {node.code} · niveau {node.level}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="text-slate-400 hover:text-slate-700 -mt-1"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>

        <div className="px-6 py-5 space-y-5">
          <section>
            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Hiérarchie</h4>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Service parent</dt>
                <dd className="font-bold text-slate-800">{parent ? parent.name : 'Racine'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Sous-services directs</dt>
                <dd className="font-bold text-slate-800">{node.children.length}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Utilisateurs rattachés</dt>
                <dd className="font-bold text-slate-800">{directUsers.length}</dd>
              </div>
            </dl>
          </section>

          <section className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onAddChild(node)}
              className="px-3 py-2.5 rounded-xl bg-white border-2 border-slate-200 text-slate-700 text-[11px] font-black uppercase tracking-widest hover:border-rdpc-blue hover:text-rdpc-blue transition-all"
            >
              + Sous-service
            </button>
            <button
              type="button"
              onClick={() => onAddUser(node)}
              className="px-3 py-2.5 rounded-xl bg-rdpc-blue text-white text-[11px] font-black uppercase tracking-widest hover:bg-blue-800 transition-all"
            >
              + Utilisateur
            </button>
          </section>

          <section>
            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">
              Utilisateurs ({directUsers.length})
            </h4>
            {directUsers.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-6 text-center">
                Aucun utilisateur rattaché à ce service.
              </p>
            ) : (
              <ul className="space-y-2">
                {directUsers.map((u) => (
                  <li key={u.id} className="flex items-center gap-3 py-2 px-3 rounded-xl bg-slate-50">
                    <Avatar name={u.full_name} matricule={u.matricule} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate">{u.full_name || '—'}</p>
                      <p className="text-[10px] text-slate-400 font-mono uppercase">{u.matricule}</p>
                      {u.reports_to && (
                        <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                          <span className="material-symbols-outlined text-[10px] align-middle">arrow_upward</span>
                          {' '}N+1 : <span className="font-bold">{u.reports_to.full_name}</span>
                        </p>
                      )}
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${ROLE_BADGE_STYLES[u.role] || 'bg-slate-100 text-slate-600'}`}>
                      {ROLE_LABELS[u.role] || u.role}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </aside>
    </div>
  );
};
