// frontend/App.tsx
import React from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { DEFAULT_ROUTE_BY_PROFILE, defaultRouteForProfile } from './lib/defaultRoute';
import { takePostLoginDestination, accountKeyOf } from './services';
import { pushClientOperationError } from './lib/errors';

import ErrorBoundary from './components/ErrorBoundary';
import ErrorOverlay from './components/ErrorOverlay';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import Documents from './components/Documents';
import TrashPage from './components/TrashPage';
import DuplicatesPage from './components/DuplicatesPage';
import WorkflowTasks from './components/WorkflowTasks';
import LoginPage from './components/LoginPage';
import ChangePassword from './components/ChangePassword';

// Pages par profil
import PlatformDashboard from './profiles/super-admin/pages/PlatformDashboard';
import AuthzAdmin from './profiles/super-admin/pages/AuthzAdmin';
import TenantsAdmin from './profiles/super-admin/pages/TenantsAdmin';
import TenantDetail from './profiles/super-admin/pages/TenantDetail';
import PlatformUsers from './profiles/super-admin/pages/PlatformUsers';
import OrgDashboard from './profiles/tenant-admin/pages/OrgDashboard';
import OrganizationPage from './profiles/tenant-admin/pages/OrganizationPage';
import GEDRulesPage from './profiles/tenant-admin/pages/GEDRulesPage';
import ClassementPage from './profiles/tenant-admin/pages/ClassementPage';
import UsersPage from './profiles/tenant-admin/pages/UsersPage';
import ServiceDashboard from './profiles/unit-admin/pages/ServiceDashboard';
import ValidationHub from './profiles/manager/pages/ValidationHub';
import DraftWorkspace from './profiles/collaborator/pages/DraftWorkspace';
import LibraryView from './profiles/reader/pages/LibraryView';
import AuditLogs from './profiles/auditor/pages/AuditLogs';
import DisplaySettings from './profiles/tenant-admin/pages/DisplaySettings';
import DirectoryIngestion from './profiles/tenant-admin/pages/DirectoryIngestion';
import PendingAssignmentsInbox from './profiles/tenant-admin/pages/PendingAssignmentsInbox';
import SpacesPage from './profiles/tenant-admin/pages/SpacesPage';
import ClassificationReviewPage from './profiles/tenant-admin/pages/ClassificationReviewPage';
import ReportsPage from './profiles/tenant-admin/pages/ReportsPage';
import LocalLibraryPage from './profiles/tenant-admin/pages/LocalLibraryPage';

// Route → activeTab mapping (pour la compatibilité Sidebar/Header)
const ROUTE_TO_TAB: Record<string, string> = {
  '/': 'dashboard',
  '/dashboard': 'dashboard',
  '/documents': 'documents',
  '/tasks': 'tasks',
  '/authz': 'authz',
  '/tenants': 'tenants',
  '/platform-users': 'platform_users',
  '/settings': 'settings',
  '/settings/display': 'settings_display',
  '/org': 'org',
  '/spaces': 'spaces',
  '/rules': 'ged_rules',
  '/classement': 'classement',
  '/users': 'users',
  '/needs-review': 'needs_review',
  '/classification-reviews': 'needs_review',
  '/pending-assignments': 'pending_assignments',
  '/ingestion': 'ingestion',
  '/local-library': 'local_library',
  '/audit': 'audit_central',
  '/my-actions': 'my_actions',
  '/reports': 'reports',
  '/trash': 'trash',
  '/duplicates': 'duplicates',
};

const TAB_TO_ROUTE: Record<string, string> = {
  'dashboard': '/dashboard',
  'documents': '/documents',
  'tasks': '/tasks',
  'authz': '/authz',
  'tenants': '/tenants',
  'platform_users': '/platform-users',
  'settings': '/settings',
  'settings_display': '/settings/display',
  'org': '/org',
  'spaces': '/spaces',
  'ged_rules': '/rules',
  'classement': '/classement',
  'users': '/users',
  'needs_review': '/classification-reviews',
  'pending_assignments': '/pending-assignments',
  'ingestion': '/ingestion',
  'local_library': '/local-library',
  'audit_central': '/audit',
  'my_actions': '/my-actions',
  'reports': '/reports',
  'trash': '/trash',
  'duplicates': '/duplicates',
};

export { defaultRouteForProfile };

type ProfileId = keyof typeof DEFAULT_ROUTE_BY_PROFILE;

// Routes réservées aux administrateurs (liste blanche par profil). Confort d'interface :
// le contrôle d'accès fait foi côté API ; cette table ne doit jamais être plus permissive qu'elle.
export const ADMIN_ROUTES = {
  '/tenants': ['super'],
  '/tenants/:tenantId': ['super'],
  '/platform-users': ['super'],
  '/authz': ['super'],
  '/org': ['super', 'tenant'],
  '/rules': ['super', 'tenant'],
  '/classement': ['super', 'tenant'],
  '/users': ['super', 'tenant'],
  // Lecture du journal : super_admin, tenant_admin, auditor (backend/app/core/authz/policy.csv).
  '/audit': ['super', 'tenant', 'audit'],
} as const satisfies Record<string, ReadonlyArray<ProfileId>>;

export const ACCESS_DENIED_MESSAGE = 'Accès réservé aux administrateurs.';
export const AUDIT_DENIED_MESSAGE = 'Accès réservé aux administrateurs et aux auditeurs.';

// Outils de rangement local : masqués au lecteur et au collaborateur dans le menu (Sidebar), refusés aussi par URL.
export const LOCAL_TOOLS_PROFILES = ['super', 'tenant', 'unit', 'manager', 'audit'] as const satisfies ReadonlyArray<ProfileId>;
export const LOCAL_TOOLS_DENIED_MESSAGE = "Cet outil n'est pas disponible pour votre profil.";

// Rend la page seulement si le profil est autorisé ; sinon renvoie vers la page d'accueil du
// profil (replace : Précédent ne ramène pas sur la route interdite) sans monter la page.
const RequireProfile: React.FC<{ allow: ReadonlyArray<string>; message?: string; children: React.ReactElement }> = ({ allow, message = ACCESS_DENIED_MESSAGE, children }) => {
  const navigate = useNavigate();
  const profileId = useAuthStore((s) => s.userProfile?.id);
  const allowed = !!profileId && allow.includes(profileId);
  const notified = React.useRef(false);

  React.useEffect(() => {
    if (allowed || notified.current) return;
    notified.current = true;
    pushClientOperationError(null, {
      fallbackDetail: message,
      errorCode: 'ROUTE_FORBIDDEN',
      severity: 'warning',
    });
    navigate(defaultRouteForProfile(profileId), { replace: true });
  }, [allowed, profileId, navigate, message]);

  return allowed ? children : null;
};

const guarded = (path: keyof typeof ADMIN_ROUTES, element: React.ReactElement) => (
  <RequireProfile allow={ADMIN_ROUTES[path]}>{element}</RequireProfile>
);

const ProfileDashboard: React.FC<{ profileId?: string }> = ({ profileId }) => {
  switch (profileId) {
    case 'super': return <PlatformDashboard />;
    case 'tenant': return <OrgDashboard />;
    case 'unit': return <ServiceDashboard />;
    case 'manager': return <ValidationHub />;
    case 'collab': return <DraftWorkspace />;
    case 'reader': return <LibraryView />;
    case 'audit': return <AuditLogs />;
    default: return <Dashboard />;
  }
};

const NotFoundPage: React.FC = () => {
  const location = useLocation();
  const segment = location.pathname.replace('/', '') || 'inconnu';
  return (
    <div className="flex items-center justify-center h-full text-slate-400">
      <div className="text-center p-12 glass rounded-[3rem] border-white max-w-sm">
        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300">
          <span className="material-symbols-outlined text-4xl">construction</span>
        </div>
        <h2 className="text-xl font-black text-slate-800 tracking-tighter uppercase italic">Espace en Travaux</h2>
        <p className="mt-3 text-sm font-medium italic">Le module <span className="text-rdpc-blue font-bold">"{segment}"</span> est en cours de configuration.</p>
      </div>
    </div>
  );
};

const AppLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { userProfile, layoutMode, setLayoutMode, justLoggedIn, consumeJustLoggedIn } = useAuthStore();

  // Tiroir de navigation (écrans < 768 px) : refermé après chaque navigation.
  const [menuOpen, setMenuOpen] = React.useState(false);
  React.useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // After a fresh login, route the user to their role-specific landing page,
  // ignoring whatever URL was left over from a previous session/user.
  // La destination est lue une seule fois par connexion : l'effet peut être rejoué (StrictMode,
  // changement de dépendance) avant que justLoggedIn repasse à false, et la lecture est destructive.
  const resumedRef = React.useRef<string | null | undefined>(undefined);
  React.useEffect(() => {
    if (!justLoggedIn) {
      resumedRef.current = undefined;
      return;
    }
    // Session expirée en cours de travail : retour à la page quittée (même compte uniquement).
    if (resumedRef.current === undefined) resumedRef.current = takePostLoginDestination(accountKeyOf(userProfile));
    const target = userProfile?.mustChangePassword
      ? '/change-password'
      : resumedRef.current ?? defaultRouteForProfile(userProfile?.id);
    consumeJustLoggedIn();
    navigate(target, { replace: true });
  }, [justLoggedIn, userProfile?.id, userProfile?.mustChangePassword, navigate, consumeJustLoggedIn]);

  // Force redirect to /change-password when the user must rotate their first-login password.
  React.useEffect(() => {
    if (userProfile?.mustChangePassword && location.pathname !== '/change-password') {
      navigate('/change-password', { replace: true });
    }
  }, [userProfile?.mustChangePassword, location.pathname, navigate]);

  if (userProfile?.mustChangePassword) {
    return <ChangePassword />;
  }

  // Derive activeTab from current URL for Sidebar/Header compatibility.
  // Use longest-prefix match so nested routes (e.g. /tenants/:id) light up the parent tab.
  const activeTab: string = (() => {
    const exact = ROUTE_TO_TAB[location.pathname];
    if (exact) return exact;
    const match = Object.keys(ROUTE_TO_TAB)
      .filter((r) => r !== '/' && (location.pathname === r || location.pathname.startsWith(`${r}/`)))
      .sort((a, b) => b.length - a.length)[0];
    const tab = match ? ROUTE_TO_TAB[match] : undefined;
    return tab ?? location.pathname.replace('/', '');
  })();

  // Bridge: convert tab ID → route navigation
  const handleTabChange = (tab: string) => {
    const route = TAB_TO_ROUTE[tab] || `/${tab}`;
    navigate(route);
  };

  return (
    <div className="h-screen bg-slate-50 flex transition-all duration-500 overflow-hidden relative">
      {layoutMode === 'sidebar' && (
        <Sidebar
          activeTab={activeTab}
          onTabChange={handleTabChange}
          userProfile={userProfile}
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
        />
      )}
      <main className={`flex-1 flex flex-col h-screen min-h-0 transition-all duration-500 ${layoutMode === 'sidebar' ? 'md:ml-72' : 'ml-0'}`}>
        <Header
          userProfile={userProfile}
          layoutMode={layoutMode}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onOpenSettings={() => navigate('/settings/display')}
          onOpenMenu={() => setMenuOpen(true)}
        />
        <div className="flex-1 min-h-0 overflow-y-auto scroll-smooth">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<ProfileDashboard profileId={userProfile?.id} />} />
            <Route path="/documents" element={<Documents />} />
            <Route path="/tasks" element={<WorkflowTasks />} />
            <Route path="/authz" element={guarded('/authz', <AuthzAdmin />)} />
            <Route path="/tenants" element={guarded('/tenants', <TenantsAdmin />)} />
            <Route path="/tenants/:tenantId" element={guarded('/tenants/:tenantId', <TenantDetail />)} />
            <Route path="/platform-users" element={guarded('/platform-users', <PlatformUsers />)} />
            <Route path="/settings" element={<DisplaySettings layoutMode={layoutMode} setLayoutMode={setLayoutMode} />} />
            <Route path="/settings/display" element={<DisplaySettings layoutMode={layoutMode} setLayoutMode={setLayoutMode} />} />
            <Route path="/org" element={guarded('/org', <OrganizationPage />)} />
            <Route path="/spaces" element={<SpacesPage />} />
            <Route path="/rules" element={guarded('/rules', <GEDRulesPage />)} />
            <Route path="/classement" element={guarded('/classement', <ClassementPage />)} />
            <Route path="/users" element={guarded('/users', <UsersPage />)} />
            <Route path="/classification-reviews" element={<ClassificationReviewPage />} />
            <Route path="/needs-review" element={<Navigate to="/classification-reviews" replace />} />
            <Route path="/pending-assignments" element={<PendingAssignmentsInbox />} />
            <Route path="/ingestion" element={<RequireProfile allow={LOCAL_TOOLS_PROFILES} message={LOCAL_TOOLS_DENIED_MESSAGE}><DirectoryIngestion /></RequireProfile>} />
            <Route path="/local-library" element={<RequireProfile allow={LOCAL_TOOLS_PROFILES} message={LOCAL_TOOLS_DENIED_MESSAGE}><LocalLibraryPage /></RequireProfile>} />
            <Route path="/audit" element={<RequireProfile allow={ADMIN_ROUTES['/audit']} message={AUDIT_DENIED_MESSAGE}><AuditLogs /></RequireProfile>} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/trash" element={<TrashPage />} />
            <Route path="/duplicates" element={<DuplicatesPage />} />
            <Route path="/change-password" element={<ChangePassword />} />
            {/* Ouverte à tous : le serveur limite aux actions de l'utilisateur (mine=true). */}
            <Route path="/my-actions" element={<AuditLogs key="my-actions" ownOnly />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </div>
        {/* AI assistant button hidden for now — will be wired when /ai/chat backend ships */}
      </main>
      <style>{`
        .mask-linear-right {
          mask-image: linear-gradient(to right, black 85%, transparent 100%);
          -webkit-mask-image: linear-gradient(to right, black 85%, transparent 100%);
        }
      `}</style>
    </div>
  );
};

const App: React.FC = () => {
  const { isLoggedIn, login } = useAuthStore();

  return (
    <ErrorBoundary>
      {isLoggedIn ? <AppLayout /> : <LoginPage onLogin={login} />}
      <ErrorOverlay />
    </ErrorBoundary>
  );
};

export default App;
