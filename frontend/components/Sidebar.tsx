
import React, { useEffect, useState } from 'react';
import { TENANT_ADMIN_MENU } from '../profiles/tenant-admin/menuConfig';
import { SUPER_ADMIN_MENU } from '../profiles/super-admin/menuConfig';
import { api } from '../services/api';
import { Logo } from './Logo';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  userProfile?: any;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange, userProfile }) => {
  const [tenantLabel, setTenantLabel] = useState<string>('');
  const [isHealthy, setIsHealthy] = useState<boolean | null>(null);

  useEffect(() => {
    if (!userProfile?.tenantId) return;
    api.getTenant(userProfile.tenantId)
      .then((t: any) => setTenantLabel(t?.short_name || t?.name || ''))
      .catch(() => setTenantLabel(''));
  }, [userProfile?.tenantId]);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        await api.getHealth();
        if (!cancelled) setIsHealthy(true);
      } catch {
        if (!cancelled) setIsHealthy(false);
      }
    };
    check();
    const id = setInterval(check, 30_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const renderProfileMenu = (menu: typeof TENANT_ADMIN_MENU) => {
    return menu.map((section, sIdx) => (
      <div key={sIdx} className="space-y-2">
        <h3 className="px-4 text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 opacity-60">
          {section.section}
        </h3>
        <div className="space-y-1">
          {section.items.map((item) => (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-300 group ${
                activeTab === item.id
                  ? 'bg-blue-50 text-rdpc-blue shadow-sm'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <span className={`material-symbols-outlined text-xl transition-transform group-hover:scale-110 ${activeTab === item.id ? 'text-rdpc-blue font-bold' : 'text-slate-400'}`}>
                {item.icon}
              </span>
              <span className={`text-[11px] font-bold uppercase tracking-tight ${activeTab === item.id ? 'font-black' : ''}`}>
                {item.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    ));
  };

  const renderMenuItems = () => {
    if (userProfile?.id === 'super') {
      return renderProfileMenu(SUPER_ADMIN_MENU);
    }

    if (userProfile?.id === 'tenant') {
      return renderProfileMenu(TENANT_ADMIN_MENU);
    }

    // Menu par défaut pour les autres
    return (
      <div className="space-y-1">
        <h3 className="px-4 text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 opacity-60 mb-2">Navigation</h3>
        {[
          { id: 'dashboard', label: 'Tableau de Bord', icon: 'dashboard' },
          { id: 'documents', label: 'Mes Documents', icon: 'description' },
          { id: 'tasks', label: 'Tâches & Suivi', icon: 'notifications' },
          { id: 'ingestion', label: 'Ranger / Importer', icon: 'folder_managed' },
          { id: 'local_library', label: 'Bibliothèque locale', icon: 'local_library' },
        ].map(item => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-300 ${activeTab === item.id ? 'bg-blue-50 text-rdpc-blue' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <span className="material-symbols-outlined text-xl">{item.icon}</span>
            <span className="text-[11px] font-bold uppercase">{item.label}</span>
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="w-72 h-screen glass border-r border-slate-200/50 flex flex-col fixed left-0 top-0 z-50">
      <div className="p-6 shrink-0 border-b border-slate-100/50">
        <Logo className="scale-90 origin-left" />
      </div>

      <nav className="flex-1 px-4 py-4 space-y-8 overflow-y-auto scrollbar-hide scroll-smooth">
        {renderMenuItems()}
      </nav>

      <div className="p-6 shrink-0">
        <div className="p-4 bg-slate-900 rounded-[2rem] text-white shadow-2xl relative overflow-hidden group cursor-pointer border border-white/10 transition-transform hover:scale-[1.02]">
          <div className="relative z-10">
            <p className="text-[8px] font-black opacity-50 uppercase tracking-[0.2em] mb-1">Ministère</p>
            <p className="text-[10px] font-black italic tracking-tighter text-cam-yellow mb-3 truncate">
              {tenantLabel || '—'}
            </p>
            <div className="flex items-center gap-2">
               <div className={`w-1.5 h-1.5 rounded-full ${isHealthy === null ? 'bg-slate-400' : isHealthy ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
               <span className="text-[8px] font-bold uppercase tracking-widest text-white/40">
                 {isHealthy === null ? 'Vérification...' : isHealthy ? 'Système Opérationnel' : 'Système Indisponible'}
               </span>
            </div>
          </div>
          <span className="material-symbols-outlined absolute -right-2 -bottom-2 text-4xl text-white/5 rotate-12">verified</span>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
