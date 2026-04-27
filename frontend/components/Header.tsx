// frontend/components/Header.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FLAT_TENANT_MENU } from '../profiles/tenant-admin/menuConfig';
import { api } from '../services/api';
import { useNotifications } from '../hooks/useNotifications';
import { useAuthStore } from '../stores/authStore';

interface HeaderProps {
  userProfile?: any;
  layoutMode?: 'sidebar' | 'topbar';
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  onOpenSettings?: () => void;
}

const Header: React.FC<HeaderProps> = ({ userProfile, layoutMode, activeTab, onTabChange, onOpenSettings }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const [showNotifications, setShowNotifications] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const { notifications, markAsRead, markAllAsRead } = useNotifications();
  const unreadCount = notifications.filter(n => !n.is_read).length;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchQuery.length >= 2) {
        setIsSearching(true);
        try {
          const data = await api.searchDocuments(searchQuery);
          setSearchResults(data.hits || data.results || []);
          setShowResults(true);
        } catch (error) {
          console.error("Search failed:", error);
          setSearchResults([]);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults([]);
        setShowResults(false);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const getMenuItems = () => {
    if (userProfile?.id === 'tenant') {
      return FLAT_TENANT_MENU;
    }
    return [
      { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
      { id: 'documents', label: 'Mes Documents', icon: 'folder_open' },
      { id: 'tasks', label: 'Tâches', icon: 'checklist' },
    ];
  };

  const menuItems = getMenuItems();

  return (
    <header className={`glass border-b border-slate-200/50 flex flex-col sticky top-0 z-40 transition-all duration-500 ${layoutMode === 'topbar' ? 'h-32' : 'h-20'}`}>
      {/* Top Section */}
      <div className="flex-1 flex items-center justify-between px-8">
        <div className="flex items-center gap-6">
          {layoutMode === 'topbar' && (
            <div className="flex items-center gap-3 pr-6 border-r border-slate-200">
              <div className={`w-10 h-10 ${userProfile?.color || 'bg-rdpc-blue'} rounded-xl flex items-center justify-center text-white shadow-lg`}>
                <span className="material-symbols-outlined text-xl">{userProfile?.icon || 'shield'}</span>
              </div>
              <div className="hidden lg:block">
                <h1 className="text-base font-black text-slate-800 tracking-tighter leading-none italic uppercase">E-Dossier</h1>
                <p className="text-[8px] uppercase font-bold text-red-500 tracking-widest mt-0.5">Gestion Documentaire</p>
              </div>
            </div>
          )}

          <div className="max-w-xl min-w-[200px] md:min-w-[400px] relative" ref={searchRef}>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                {isSearching ? (
                  <span className="material-symbols-outlined text-rdpc-blue animate-spin transition-colors">sync</span>
                ) : (
                  <span className="material-symbols-outlined text-slate-300 group-focus-within:text-rdpc-blue transition-colors">search</span>
                )}
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => { if (searchQuery.length >= 2) setShowResults(true); }}
                placeholder="Rechercher avec le Moteur Avancé (Documents, Intérieur OCR)..."
                className="block w-full pl-12 pr-4 py-2.5 bg-slate-100/50 border border-transparent rounded-2xl focus:bg-white focus:ring-8 focus:ring-blue-500/5 focus:border-blue-200 transition-all outline-none text-[13px] font-medium"
              />
            </div>
            {/* Search Results Dropdown */}
            {showResults && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
                {searchResults.length > 0 ? (
                  <div className="max-h-96 overflow-y-auto">
                    <div className="p-2 border-b border-slate-50">
                      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-2 pt-1">{searchResults.length} RÉSULTATS (FULL-TEXT)</p>
                    </div>
                    {searchResults.map((result) => (
                      <div key={result.id} className="p-3 hover:bg-slate-50 border-b border-slate-50 last:border-0 cursor-pointer flex items-center gap-3 group transition-colors">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-rdpc-blue flex items-center justify-center shrink-0 group-hover:bg-rdpc-blue group-hover:text-white transition-colors">
                          <span className="material-symbols-outlined text-lg">{result.file_type?.includes('pdf') ? 'picture_as_pdf' : 'description'}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-bold text-slate-800 truncate">{result.title}</h4>
                          <p className="text-[10px] text-slate-400 font-medium truncate">Catégorie: {result.category_name || 'Non classé'} • Statut: {result.status}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 text-center text-slate-500 text-sm font-medium">
                    Aucun document trouvé pour cette recherche.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-6">
          <div className="flex items-center" ref={notifRef}>
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className={`w-10 h-10 rounded-xl flex items-center justify-center hover:bg-slate-100 transition-all relative ${showNotifications ? 'bg-slate-100 text-rdpc-blue' : 'text-slate-400'}`}
              >
                <span className="material-symbols-outlined text-xl">notifications</span>
                {unreadCount > 0 && (
                  <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-red-500 border-2 border-white rounded-full animate-pulse"></span>
                )}
              </button>

              {/* Notifications Dropdown */}
              {showNotifications && (
                <div className="absolute top-full right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
                  <div className="p-3 border-b border-slate-50 flex justify-between items-center">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-2">Notifications</p>
                    {unreadCount > 0 && (
                      <button onClick={markAllAsRead} className="text-[10px] font-bold text-rdpc-blue hover:underline pr-2">Tout marquer comme lu</button>
                    )}
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {notifications.length > 0 ? (
                      notifications.map((notif) => (
                        <div
                          key={notif.id}
                          onClick={() => { if (!notif.is_read) markAsRead(notif.id); }}
                          className={`p-4 border-b border-slate-50 relative cursor-pointer hover:bg-slate-50 transition-colors ${!notif.is_read ? 'bg-blue-50/30' : ''}`}
                        >
                          {!notif.is_read && <div className="absolute left-0 top-0 bottom-0 w-1 bg-rdpc-blue"></div>}
                          <p className={`text-xs ${!notif.is_read ? 'font-bold text-slate-800' : 'font-medium text-slate-600'}`}>
                            {notif.message}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-1">
                            {new Date(notif.created_at).toLocaleString()}
                          </p>
                        </div>
                      ))
                    ) : (
                      <div className="p-6 text-center text-slate-500 text-xs font-medium">
                        Aucune notification
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => setShowHelp(true)}
              className="w-10 h-10 rounded-xl text-slate-400 flex items-center justify-center hover:bg-slate-100 hover:text-rdpc-blue transition-all"
              title="Aide"
            >
              <span className="material-symbols-outlined text-xl">help_outline</span>
            </button>
            <button
              onClick={onOpenSettings}
              className="w-10 h-10 rounded-xl text-slate-400 flex items-center justify-center hover:bg-slate-100 hover:text-rdpc-blue transition-all group"
            >
              <span className="material-symbols-outlined text-xl group-hover:rotate-90 transition-transform duration-500">settings</span>
            </button>
          </div>

          <div className="h-8 w-[1px] bg-slate-200 hidden md:block"></div>

          <div className="relative" ref={userMenuRef}>
            <button
              type="button"
              onClick={() => setShowUserMenu((v) => !v)}
              className="flex items-center gap-3 cursor-pointer group focus:outline-none focus:ring-2 focus:ring-rdpc-blue/40 rounded-xl"
              aria-haspopup="menu"
              aria-expanded={showUserMenu}
            >
              <div className="text-right hidden lg:block">
                <p className="text-xs font-black text-slate-800 leading-none group-hover:text-rdpc-blue transition-colors italic uppercase">{userProfile?.name || 'Agent'}</p>
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter mt-1">{userProfile?.label || 'Agent'}</p>
              </div>
              <img
                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${userProfile?.id || 'admin'}`}
                alt="Avatar"
                className="w-10 h-10 rounded-xl border-2 border-white shadow-md group-hover:scale-110 transition-transform bg-slate-100"
              />
            </button>
            {showUserMenu && (
              <div
                role="menu"
                className="absolute right-0 top-full mt-2 w-56 rounded-2xl bg-white shadow-2xl border border-slate-100 overflow-hidden z-50"
              >
                <div className="px-4 py-3 border-b border-slate-100">
                  <p className="text-xs font-black text-slate-800 uppercase truncate">{userProfile?.name || 'Agent'}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5 truncate">{userProfile?.matricule || userProfile?.label || ''}</p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    setShowUserMenu(false);
                    await logout();
                    navigate('/', { replace: true });
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors"
                  role="menuitem"
                >
                  <span className="material-symbols-outlined text-lg">logout</span>
                  <span>Se déconnecter</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Section (Navigation) */}
      {layoutMode === 'topbar' && (
        <div className="h-12 bg-white/50 border-t border-slate-100 flex items-center px-8 overflow-hidden group/nav">
          <nav className="flex gap-1 overflow-x-auto scrollbar-hide py-1 mask-linear-right">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onTabChange?.(item.id)}
                className={`px-4 h-9 rounded-xl flex items-center gap-2 transition-all duration-300 shrink-0 ${activeTab === item.id
                  ? 'bg-rdpc-blue text-white shadow-lg'
                  : 'text-slate-500 hover:bg-slate-100'
                  }`}
              >
                <span className="material-symbols-outlined text-lg">{item.icon}</span>
                <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">{item.label}</span>
              </button>
            ))}
          </nav>
        </div>
      )}

      {showHelp && (
        <div
          className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setShowHelp(false)}
        >
          <div
            className="bg-white rounded-[2rem] shadow-2xl max-w-lg w-full p-8 space-y-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-rdpc-blue rounded-full text-[9px] font-black uppercase tracking-[0.2em] mb-3">
                  Aide
                </div>
                <h3 className="text-2xl font-black text-slate-800 tracking-tighter italic uppercase">E-Dossier — Support</h3>
              </div>
              <button
                onClick={() => setShowHelp(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-400 flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <div className="space-y-3">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Raccourcis</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between py-1.5 border-b border-slate-50">
                  <span className="text-slate-600">Rechercher</span>
                  <kbd className="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-mono font-bold text-slate-700">/</kbd>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-slate-50">
                  <span className="text-slate-600">Fermer une modale</span>
                  <kbd className="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-mono font-bold text-slate-700">Esc</kbd>
                </div>
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-slate-600">Actualiser la vue</span>
                  <kbd className="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-mono font-bold text-slate-700">F5</kbd>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Liens utiles</h4>
              <a
                href={`${(import.meta as any).env?.VITE_API_URL?.replace(/\/api\/v1\/?$/, '') || 'http://localhost:8000'}/api/docs`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 bg-slate-50 hover:bg-blue-50 rounded-xl transition-colors group"
              >
                <span className="material-symbols-outlined text-slate-400 group-hover:text-rdpc-blue">description</span>
                <div className="flex-1">
                  <p className="text-sm font-bold text-slate-700">Documentation API (Swagger)</p>
                  <p className="text-[10px] text-slate-400">OpenAPI interactive — endpoints et schémas</p>
                </div>
                <span className="material-symbols-outlined text-slate-300 text-sm">open_in_new</span>
              </a>
              <a
                href="mailto:support@edossier.cm"
                className="flex items-center gap-3 p-3 bg-slate-50 hover:bg-blue-50 rounded-xl transition-colors group"
              >
                <span className="material-symbols-outlined text-slate-400 group-hover:text-rdpc-blue">mail</span>
                <div className="flex-1">
                  <p className="text-sm font-bold text-slate-700">Contacter le support</p>
                  <p className="text-[10px] text-slate-400">support@edossier.cm</p>
                </div>
              </a>
            </div>

            <p className="text-[10px] text-slate-300 text-center pt-2 border-t border-slate-50">
              E-Dossier — v1.0.0
            </p>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
