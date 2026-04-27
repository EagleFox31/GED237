import { create } from 'zustand';
import { api, clearAuthSession, persistAuthTokens, type AuthSession, type BackendUser } from '../services/api';

export interface UserProfile {
  id: string;
  label: string;
  role: string;
  icon: string;
  color: string;
  name: string;
  backendRole?: string;
  backendRoleLabel?: string;
  matricule?: string;
  email?: string;
  tenantId?: string;
  orgUnitId?: string;
  mustChangePassword?: boolean;
}

const DEFAULT_PROFILE: UserProfile = {
  id: 'agent',
  label: 'Agent',
  role: 'Utilisateur',
  icon: 'shield',
  color: 'bg-rdpc-blue',
  name: 'Utilisateur',
};

const ROLE_PROFILE_MAP: Record<string, Omit<UserProfile, 'name' | 'backendRole' | 'backendRoleLabel' | 'matricule' | 'email' | 'tenantId' | 'orgUnitId'>> = {
  SUPER_ADMIN: { id: 'super', label: 'Super Admin', role: 'Plateforme', icon: 'security_update_good', color: 'bg-cam-red' },
  TENANT_ADMIN: { id: 'tenant', label: 'Admin Tenant', role: 'Organisation', icon: 'account_balance', color: 'bg-rdpc-blue' },
  UNIT_ADMIN: { id: 'unit', label: 'Admin Unité', role: 'Service', icon: 'domain', color: 'bg-blue-500' },
  MANAGER: { id: 'manager', label: 'Manager', role: 'Valideur', icon: 'verified', color: 'bg-cam-yellow' },
  COLLABORATOR: { id: 'collab', label: 'Collaborateur', role: 'Contributeur', icon: 'edit_square', color: 'bg-cam-green' },
  READER: { id: 'reader', label: 'Lecteur', role: 'Consultation', icon: 'menu_book', color: 'bg-slate-400' },
  AUDITOR: { id: 'audit', label: 'Auditeur', role: 'Compliance', icon: 'analytics', color: 'bg-purple-600' },
};

const PROFILE_BY_ID: Record<string, keyof typeof ROLE_PROFILE_MAP> = {
  super: 'SUPER_ADMIN',
  tenant: 'TENANT_ADMIN',
  unit: 'UNIT_ADMIN',
  manager: 'MANAGER',
  collab: 'COLLABORATOR',
  reader: 'READER',
  audit: 'AUDITOR',
};

const toTitleCase = (value?: string | null) =>
  value
    ? value
        .toLowerCase()
        .split(' ')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ')
    : '';

const resolveTemplate = (value?: string | null) => {
  if (!value) {
    return null;
  }

  const normalized = value.toUpperCase();
  if (ROLE_PROFILE_MAP[normalized]) {
    return ROLE_PROFILE_MAP[normalized];
  }

  const byId = PROFILE_BY_ID[value.toLowerCase()];
  if (byId) {
    return ROLE_PROFILE_MAP[byId];
  }

  return null;
};

const normalizeBackendUser = (user: BackendUser): UserProfile => {
  const template = resolveTemplate(user.role) || DEFAULT_PROFILE;

  return {
    ...template,
    id: template.id,
    label: template.label,
    role: template.role,
    icon: template.icon,
    color: template.color,
    name: user.full_name || `${toTitleCase(user.first_name)} ${toTitleCase(user.last_name)}`.trim() || user.matricule,
    backendRole: user.role,
    backendRoleLabel: user.role_label,
    matricule: user.matricule,
    email: user.email || undefined,
    tenantId: user.tenant_id,
    orgUnitId: user.org_unit_id || undefined,
    mustChangePassword: user.must_change_password || false,
  };
};

const normalizeStoredProfile = (profile: unknown): UserProfile | null => {
  if (!profile || typeof profile !== 'object') {
    return null;
  }

  const candidate = profile as Partial<UserProfile> & Partial<BackendUser> & Record<string, unknown>;
  const template = resolveTemplate(candidate.backendRole as string | undefined) || resolveTemplate(candidate.role as string | undefined) || resolveTemplate(candidate.id as string | undefined);

  if (template) {
    return {
      ...template,
      id: template.id,
      label: candidate.label?.toString() || template.label,
      role: candidate.role?.toString() || template.role,
      icon: candidate.icon?.toString() || template.icon,
      color: candidate.color?.toString() || template.color,
      name: candidate.name?.toString() || candidate.full_name?.toString() || 'Utilisateur',
      backendRole: candidate.backendRole?.toString() || candidate.role?.toString(),
      backendRoleLabel: candidate.backendRoleLabel?.toString() || candidate.role_label?.toString(),
      matricule: candidate.matricule?.toString(),
      email: candidate.email?.toString(),
      tenantId: candidate.tenantId?.toString() || candidate.tenant_id?.toString(),
      orgUnitId: candidate.orgUnitId?.toString() || candidate.org_unit_id?.toString(),
      mustChangePassword: Boolean(candidate.mustChangePassword ?? candidate.must_change_password ?? false),
    };
  }

  if (typeof candidate.id === 'string') {
    return {
      ...DEFAULT_PROFILE,
      id: candidate.id,
      label: candidate.label?.toString() || DEFAULT_PROFILE.label,
      role: candidate.role?.toString() || DEFAULT_PROFILE.role,
      icon: candidate.icon?.toString() || DEFAULT_PROFILE.icon,
      color: candidate.color?.toString() || DEFAULT_PROFILE.color,
      name: candidate.name?.toString() || candidate.full_name?.toString() || DEFAULT_PROFILE.name,
      backendRole: candidate.backendRole?.toString() || candidate.role?.toString(),
      backendRoleLabel: candidate.backendRoleLabel?.toString() || candidate.role_label?.toString(),
      matricule: candidate.matricule?.toString(),
      email: candidate.email?.toString(),
      tenantId: candidate.tenantId?.toString() || candidate.tenant_id?.toString(),
      orgUnitId: candidate.orgUnitId?.toString() || candidate.org_unit_id?.toString(),
      mustChangePassword: Boolean(candidate.mustChangePassword ?? candidate.must_change_password ?? false),
    };
  }

  return null;
};

const getStoredProfile = () => {
  const stored = sessionStorage.getItem('user_profile');

  if (!stored) {
    return null;
  }

  try {
    return normalizeStoredProfile(JSON.parse(stored));
  } catch {
    clearAuthSession(false);
    return null;
  }
};

const initialProfile = getStoredProfile();

interface AuthState {
  isLoggedIn: boolean;
  userProfile: UserProfile | null;
  layoutMode: 'sidebar' | 'topbar';
  justLoggedIn: boolean;

  login: (session: AuthSession) => void;
  logout: () => Promise<void>;
  setLayoutMode: (mode: 'sidebar' | 'topbar') => void;
  clearMustChangePassword: () => void;
  consumeJustLoggedIn: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isLoggedIn: !!sessionStorage.getItem('access_token') && !!initialProfile,
  userProfile: initialProfile,
  layoutMode: 'sidebar',
  justLoggedIn: false,

  login: (session) => {
    persistAuthTokens(session.access_token, session.refresh_token);

    const profile = normalizeBackendUser(session.user);
    sessionStorage.setItem('user_profile', JSON.stringify(profile));

    set({ isLoggedIn: true, userProfile: profile, justLoggedIn: true });
  },

  logout: async () => {
    try {
      await api.logout();
    } catch {
      clearAuthSession(false);
    }

    clearAuthSession(false);
    set({ isLoggedIn: false, userProfile: null, justLoggedIn: false });
  },

  setLayoutMode: (mode) => set({ layoutMode: mode }),

  clearMustChangePassword: () => set((state) => {
    if (!state.userProfile) return state;
    const updated = { ...state.userProfile, mustChangePassword: false };
    sessionStorage.setItem('user_profile', JSON.stringify(updated));
    return { userProfile: updated };
  }),

  consumeJustLoggedIn: () => set({ justLoggedIn: false }),
}));

export const mapBackendUserToProfile = normalizeBackendUser;
