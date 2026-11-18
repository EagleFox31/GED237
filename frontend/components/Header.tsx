// frontend/components/Header.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { notificationTarget } from '../lib/notificationTarget';
import { FLAT_TENANT_MENU } from '../profiles/tenant-admin/menuConfig';
import { api } from '../services/api';
import { useNotifications } from '../hooks/useNotifications';
import { useAuthStore } from '../stores/authStore';
import { Avatar } from './ui/Avatar';
import { HighlightedExcerpt } from './HighlightedExcerpt';
import { getStatusLabel } from '../types';

/** Résultat de `GET /search` (SearchHitResponse côté serveur). */
// Borne de `q` côté serveur pour GET /documents (au-delà : 422).
const SEARCH_MAX_LENGTH = 120;

interface SearchHit {
  document_id: string;
  title: string;
  status: string;
  category?: string | null;
  file_type?: string | null;
  /** Extrait du contenu lu, mot trouvé entre <mark> (jamais injecté comme HTML). */
  highlight?: string | null;
}

/**
 * Configuration de la barre de recherche par route.
 *
 * - `mode: 'global'` (défaut) → comportement historique : debounce 500ms,
 *   appel à `api.searchDocuments`, dropdown de résultats.
 * - `mode: 'page-local'` → la barre devient le **filtre principal de la page
 *   courante**. Aucune requête HTTP. La valeur saisie est écrite dans le
 *   query param `?q=` ; la page lit ce param via `useSearchParams` et
 *   filtre sa propre liste.
 *
 * Pattern Slack/GitHub/Notion : la search globale s'adapte au contexte de
 * la page, évitant la duplication d'un champ de recherche sur chaque écran.
 */
type SearchMode = 'global' | 'page-local';
interface RouteSearchConfig {
  mode: SearchMode;
  placeholder: string;
}
const ROUTE_SEARCH_CONFIG: Record<string, RouteSearchConfig> = {
  '/users': {
    mode: 'page-local',
    placeholder: 'Rechercher un agent (nom, matricule, email)…',
  },
  '/spaces': {
    mode: 'page-local',
    placeholder: 'Rechercher un document, un chemin…',
  },
  '/documents': {
    mode: 'page-local',
    // GET /documents?q= filtre titre, mots-clés, classement et catégorie ; le texte lu dans les scans
    // n'est cherché que par la recherche globale (GET /search).
    placeholder: 'Rechercher par titre, mot-clé ou catégorie…',
  },
  '/pending-assignments': {
    mode: 'page-local',
    placeholder: 'Rechercher par document ou étape…',
  },
};
const DEFAULT_SEARCH_CONFIG: RouteSearchConfig = {
  mode: 'global',
  placeholder: 'Rechercher un document (titre ou contenu)…',
};

const resolveSearchConfig = (pathname: string): RouteSearchConfig => {
  // Longest-prefix match pour gérer /users/123 si on l'ajoute plus tard.
  const matches = Object.keys(ROUTE_SEARCH_CONFIG)
    .filter((r) => pathname === r || pathname.startsWith(`${r}/`))
    .sort((a, b) => b.length - a.length);
  const match = matches[0];
  if (!match) return DEFAULT_SEARCH_CONFIG;
  return ROUTE_SEARCH_CONFIG[match] ?? DEFAULT_SEARCH_CONFIG;
};

interface HeaderProps {
  userProfile?: any;
  layoutMode?: 'sidebar' | 'topbar';
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  onOpenSettings?: () => void;
  /** Ouvre la barre latérale repliée (écrans étroits). */
  onOpenMenu?: () => void;
}

const Header: React.FC<HeaderProps> = ({ userProfile, layoutMode, activeTab, onTabChange, onOpenSettings, onOpenMenu }) => {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchConfig = resolveSearchConfig(location.pathname);
  const isPageLocalSearch = searchConfig.mode === 'page-local';

  // En mode "global" : state local + appels API. En mode "page-local" :
  // la valeur est portée par l'URL (?q=...) → pas de duplication de state.
  const urlQuery = searchParams.get('q') || '';
  const [globalQuery, setGlobalQuery] = useState('');
  // Mode "page-local" : le champ affiche une saisie locale, poussée vers l'URL.
  // La mise à jour de l'URL est différée par le routeur : lier le champ directement
  // à l'URL faisait perdre les touches frappées avant le rendu suivant (#163).
  const [pageDraft, setPageDraft] = useState(urlQuery);
  const pendingUrlQueryRef = useRef<string | null>(null);
  const lastPathRef = useRef(location.pathname);
  useEffect(() => {
    const pathChanged = lastPathRef.current !== location.pathname;
    lastPathRef.current = location.pathname;
    const pending = pendingUrlQueryRef.current;
    // Changement venu d'ailleurs (lien, navigation, retour) : l'URL fait foi.
    if (pathChanged || pending === null) {
      pendingUrlQueryRef.current = null;
      setPageDraft(urlQuery);
    } else if (urlQuery === pending) {
      // L'URL a rattrapé la saisie ; les valeurs intermédiaires sont ignorées.
      pendingUrlQueryRef.current = null;
    }
  }, [urlQuery, location.pathname]);
  const searchQuery = isPageLocalSearch ? pageDraft : globalQuery;
  const setSearchQuery = (next: string) => {
    if (isPageLocalSearch) {
      setPageDraft(next);
      // Valeur déjà dans l'URL (lettre tapée puis effacée avant le rendu) : l'URL ne
      // changera pas et l'effet ne repassera pas ; rien n'est donc en attente.
      pendingUrlQueryRef.current = next === urlQuery ? null : next;
      // `replace: true` pour ne pas polluer l'historique du navigateur à
      // chaque frappe — on garde une seule entrée pour la session de filtrage.
      setSearchParams(
        (current) => {
          const nextParams = new URLSearchParams(current);
          if (next) nextParams.set('q', next);
          else nextParams.delete('q');
          return nextParams;
        },
        { replace: true }
      );
    } else {
      setGlobalQuery(next);
    }
  };

  const [searchResults, setSearchResults] = useState<SearchHit[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  // Requête qui a produit `searchResults` : Entrée n'ouvre un résultat que s'il
  // correspond au texte saisi (pas de résultat périmé pendant le délai de frappe).
  const [resultsQuery, setResultsQuery] = useState('');
  const latestSearchRef = useRef(0);
  const [showResults, setShowResults] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  // Un résultat ouvre la fiche du document dans « Mes documents » (?open=<id>).
  const openSearchResult = (hit: SearchHit) => {
    setShowResults(false);
    setGlobalQuery('');
    navigate(`/documents?open=${encodeURIComponent(hit.document_id)}`);
  };

  // Au changement de route, on nettoie l'état UI hérité (dropdown global) :
  // pas de sens d'afficher des résultats /spaces quand on arrive sur /users.
  useEffect(() => {
    setShowResults(false);
    setSearchResults([]);
    if (isPageLocalSearch) {
      setGlobalQuery('');
    }
  }, [location.pathname, isPageLocalSearch]);

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
  const { notifications, markAsRead, markAllAsRead, loadNotifications } = useNotifications();
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
    // En mode "page-local", la frappe pilote le filtre via `?q=` ; pas
    // d'appel API global à déclencher.
    if (isPageLocalSearch) return;
    const delayDebounceFn = setTimeout(async () => {
      latestSearchRef.current += 1;
      const request = latestSearchRef.current;
      if (searchQuery.length >= 2) {
        setIsSearching(true);
        try {
          const data = await api.searchDocuments(searchQuery);
          if (request !== latestSearchRef.current) return;
          setSearchResults(data.hits || data.results || []);
          setResultsQuery(searchQuery);
          setShowResults(true);
        } catch (error) {
          if (request !== latestSearchRef.current) return;
          console.error("Search failed:", error);
          setSearchResults([]);
          setResultsQuery('');
        } finally {
          if (request === latestSearchRef.current) setIsSearching(false);
        }
      } else {
        setSearchResults([]);
        setShowResults(false);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, isPageLocalSearch]);

  const getMenuItems = () => {
    if (userProfile?.id === 'tenant') {
      return FLAT_TENANT_MENU;
    }
    return [
      { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
      { id: 'documents', label: 'Mes Documents', icon: 'folder_open' },
      { id: 'tasks', label: 'Tâches', icon: 'checklist' },
      ...(userProfile?.id === 'audit' ? [{ id: 'audit', label: 'Audit', icon: 'analytics' }] : []),
    ];
  };

  const menuItems = getMenuItems();

  return (
    <header className={`glass border-b border-slate-200/50 flex flex-col sticky top-0 z-40 shrink-0 transition-all duration-500 ${layoutMode === 'topbar' ? 'h-32' : 'h-20'}`}>
      {/* Top Section */}
      <div className="flex-1 flex items-center justify-between px-4 md:px-8">
        <div className="flex items-center gap-3 md:gap-6">
          {layoutMode === 'sidebar' && onOpenMenu && (
            <button
              type="button"
              onClick={onOpenMenu}
              aria-label="Ouvrir le menu"
              className="md:hidden flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600"
            >
              <span className="material-symbols-outlined">menu</span>
            </button>
          )}
          {layoutMode === 'topbar' && (
            <div className="flex items-center gap-3 pr-6 border-r border-slate-200">
              <div className={`w-10 h-10 ${userProfile?.color || 'bg-rdpc-blue'} rounded-xl flex items-center justify-center text-white shadow-lg`}>
                <span className="material-symbols-outlined text-xl">{userProfile?.icon || 'shield'}</span>
              </div>
              <div className="hidden lg:block">
                <h1 className="text-base font-black text-slate-800 tracking-tighter leading-none italic uppercase">E-Dossier</h1>
                <p className="text-[8px] uppercase font-bold text-red-700 tracking-widest mt-0.5">Gestion Documentaire</p>
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
                onFocus={() => {
                  if (!isPageLocalSearch && searchQuery.length >= 2) setShowResults(true);
                }}
                onKeyDown={(e) => {
                  // Entrée : ouvre le premier résultat de la recherche globale, seulement
                  // s'il correspond au texte saisi (sinon on attend les nouveaux résultats).
                  const first = searchResults[0];
                  const resultsAreCurrent = !isSearching && resultsQuery === searchQuery;
                  if (e.key === 'Enter' && !isPageLocalSearch && showResults && first && resultsAreCurrent) {
                    e.preventDefault();
                    openSearchResult(first);
                  }
                }}
                maxLength={SEARCH_MAX_LENGTH}
                placeholder={searchConfig.placeholder}
                aria-label={searchConfig.placeholder}
                data-global-search
                className="block w-full pl-12 pr-4 py-2.5 bg-slate-100/50 border border-transparent rounded-2xl focus:bg-white focus:ring-8 focus:ring-blue-500/5 focus:border-blue-200 transition-all outline-none text-[13px] font-medium"
              />
            </div>
            {/* Search Results Dropdown — uniquement en mode global */}
            {!isPageLocalSearch && showResults && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
                {searchResults.length > 0 ? (
                  <div className="max-h-96 overflow-y-auto">
                    <div className="p-2 border-b border-slate-50">
                      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-2 pt-1">{searchResults.length} {searchResults.length > 1 ? 'résultats' : 'résultat'}</p>
                    </div>
                    {searchResults.map((result) => (
                      <button
                        type="button"
                        key={result.document_id}
                        onClick={() => openSearchResult(result)}
                        aria-label={`Ouvrir ${result.title}`}
                        className="w-full text-left p-3 hover:bg-slate-50 focus:bg-slate-50 focus:outline-none border-b border-slate-50 last:border-0 cursor-pointer flex items-center gap-3 group transition-colors"
                      >
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-rdpc-blue flex items-center justify-center shrink-0 group-hover:bg-rdpc-blue group-hover:text-white transition-colors">
                          <span className="material-symbols-outlined text-lg">{result.file_type?.includes('pdf') ? 'picture_as_pdf' : 'description'}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-bold text-slate-800 truncate">{result.title}</h4>
                          <p className="text-[10px] text-slate-400 font-medium truncate">
                            {result.category ? `${result.category} • ` : ''}{getStatusLabel(result.status)}
                          </p>
                          <HighlightedExcerpt
                            highlight={result.highlight}
                            className="text-xs text-slate-600 mt-1 line-clamp-2 break-words"
                          />
                        </div>
                      </button>
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
                type="button"
                onClick={() => {
                  // Pas de temps réel (WebSocket en V1.1) : liste relue à chaque ouverture.
                  if (!showNotifications) loadNotifications();
                  setShowNotifications(!showNotifications);
                }}
                aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} non lue${unreadCount > 1 ? 's' : ''}` : 'Notifications'}
                aria-expanded={showNotifications}
                className={`w-10 h-10 rounded-xl flex items-center justify-center hover:bg-slate-100 transition-all relative ${showNotifications ? 'bg-slate-100 text-rdpc-blue' : 'text-slate-400'}`}
              >
                <span className="material-symbols-outlined text-xl">notifications</span>
                {unreadCount > 0 && (
                  <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-red-500 border-2 border-white rounded-full animate-pulse"></span>
                )}
              </button>

              {/* Notifications Dropdown */}
              {showNotifications && (
                <div role="region" aria-label="Liste des notifications" className="absolute top-full right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
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
                          onClick={() => {
                            if (!notif.is_read) markAsRead(notif.id);
                            setShowNotifications(false);
                            navigate(notificationTarget(notif.meta_data));
                          }}
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
              type="button"
              aria-label="Aide"
              onClick={() => setShowHelp(true)}
              className="w-10 h-10 rounded-xl text-slate-400 flex items-center justify-center hover:bg-slate-100 hover:text-rdpc-blue transition-all"
              title="Aide"
            >
              <span className="material-symbols-outlined text-xl">help_outline</span>
            </button>
            <button
              type="button"
              aria-label="Paramètres"
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
                <p className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter mt-1">{userProfile?.label || 'Agent'}</p>
              </div>
              <Avatar
                name={userProfile?.name || 'Agent'}
                matricule={userProfile?.id || 'admin'}
                square
                className="border-2 border-white shadow-md group-hover:scale-110 transition-transform"
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
                type="button"
                aria-label="Fermer l'aide"
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
