export interface Tenant {
  id: string;
  name: string;
  short_name?: string | null;
  domain?: string | null;
  is_active: boolean;
  created_at: string;
}

export interface TenantUser {
  id: string;
  matricule: string;
  first_name?: string | null;
  last_name?: string | null;
  full_name: string;
  email?: string | null;
  role: string;
  role_label: string;
  is_active: boolean;
  org_unit_id?: string | null;
  reports_to_user_id?: string | null;
  reports_to?: {
    id: string;
    matricule: string;
    full_name: string;
    role?: string | null;
  } | null;
}

export interface OrgUnitNode {
  id: string;
  name: string;
  code: string;
  level: number;
  parent_id: string | null;
  children: OrgUnitNode[];
}

export interface DocStats {
  total: number;
  trashed: number;
  by_status: Record<string, number>;
}

export interface WfStats {
  active_workflow_steps: number;
  completed_workflow_steps: number;
}

export type Tab = 'summary' | 'admins' | 'users' | 'services' | 'workflows';
