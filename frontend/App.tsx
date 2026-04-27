// frontend/App.tsx
import React from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';

import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import Documents from './components/Documents';
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
import ServiceDashboard from './profiles/unit-admin/pages/ServiceDashboard';
import ValidationHub from './profiles/manager/pages/ValidationHub';
import DraftWorkspace from './profiles/collaborator/pages/DraftWorkspace';
import LibraryView from './profiles/reader/pages/LibraryView';
import AuditLogs from './profiles/auditor/pages/AuditLogs';
import DisplaySettings from './profiles/tenant-admin/pages/DisplaySettings';
import DirectoryIngestion from './profiles/tenant-admin/pages/DirectoryIngestion';
import NeedsReviewInbox from './profiles/tenant-admin/pages/NeedsReviewInbox';
import PendingAssignmentsInbox from './profiles/tenant-admin/pages/PendingAssignmentsInbox';

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
  '/rules': 'ged_rules',
  '/needs-review': 'needs_review',
  '/pending-assignments': 'pending_assignments',
  '/ingestion': 'ingestion',
  '/audit': 'audit_central',
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
  'ged_rules': '/rules',
  'needs_review': '/needs-review',
  'pending_assignments': '/pending-assignments',
  'ingestion': '/ingestion',
  'audit_central': '/audit',
};

const DEFAULT_ROUTE_BY_PROFILE: Record<string, string> = {
  super: '/tenants',
  tenant: '/dashboard',
  unit: '/dashboard',
  manager: '/tasks',
  collab: '/dashboard',
  reader: '/documents',
  audit: '/audit',
};

export const defaultRouteForProfile = (profileId?: string): string =>
  (profileId && DEFAULT_ROUTE_BY_PROFILE[profileId]) || '/dashboard';

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

  // After a fresh login, route the user to their role-specific landing page,
  // ignoring whatever URL was left over from a previous session/user.
  React.useEffect(() => {
    if (justLoggedIn) {
      const target = userProfile?.mustChangePassword
        ? '/change-password'
        : defaultRouteForProfile(userProfile?.id);
      consumeJustLoggedIn();
      navigate(target, { replace: true });
    }
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
      .filter((r) => r !== '/' && (location.pathname === r || location.pathname.startsWith(r + '/')))
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
    <div className="min-h-screen bg-slate-50 flex transition-all duration-500 overflow-hidden relative">
      {layoutMode === 'sidebar' && (
        <Sidebar activeTab={activeTab} onTabChange={handleTabChange} userProfile={userProfile} />
      )}
      <main className={`flex-1 flex flex-col min-h-screen transition-all duration-500 ${layoutMode === 'sidebar' ? 'ml-64' : 'ml-0'}`}>
        <Header
          userProfile={userProfile}
          layoutMode={layoutMode}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onOpenSettings={() => navigate('/settings/display')}
        />
        <div className="flex-1 overflow-y-auto scroll-smooth">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<ProfileDashboard profileId={userProfile?.id} />} />
            <Route path="/documents" element={<Documents />} />
            <Route path="/tasks" element={<WorkflowTasks />} />
            <Route path="/authz" element={<AuthzAdmin />} />
            <Route path="/tenants" element={<TenantsAdmin />} />
            <Route path="/tenants/:tenantId" element={<TenantDetail />} />
            <Route path="/platform-users" element={<PlatformUsers />} />
            <Route path="/settings" element={<DisplaySettings layoutMode={layoutMode} setLayoutMode={setLayoutMode} />} />
            <Route path="/settings/display" element={<DisplaySettings layoutMode={layoutMode} setLayoutMode={setLayoutMode} />} />
            <Route path="/org" element={<OrganizationPage />} />
            <Route path="/rules" element={<GEDRulesPage />} />
            <Route path="/needs-review" element={<NeedsReviewInbox />} />
            <Route path="/pending-assignments" element={<PendingAssignmentsInbox />} />
            <Route path="/ingestion" element={<DirectoryIngestion />} />
            <Route path="/audit" element={<AuditLogs />} />
            <Route path="/change-password" element={<ChangePassword />} />
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

  if (!isLoggedIn) {
    return <LoginPage onLogin={login} />;
  }

  return <AppLayout />;
};

export default App;
