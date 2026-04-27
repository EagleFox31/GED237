export const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  tenant_admin: 'Admin Institution',
  unit_admin: 'Admin Service',
  manager: 'Responsable',
  collaborator: 'Collaborateur',
  reader: 'Lecteur',
  auditor: 'Auditeur',
};

export const ROLE_BADGE_STYLES: Record<string, string> = {
  super_admin: 'bg-cam-red/10 text-cam-red',
  tenant_admin: 'bg-rdpc-blue/10 text-rdpc-blue',
  unit_admin: 'bg-emerald-50 text-emerald-700',
  manager: 'bg-amber-50 text-amber-700',
  collaborator: 'bg-violet-50 text-violet-700',
  reader: 'bg-slate-100 text-slate-600',
  auditor: 'bg-fuchsia-50 text-fuchsia-700',
};

export const ROLES = [
  { value: 'tenant_admin', label: 'Admin Institution' },
  { value: 'unit_admin', label: 'Admin Service' },
  { value: 'manager', label: 'Responsable' },
  { value: 'collaborator', label: 'Collaborateur' },
  { value: 'reader', label: 'Lecteur' },
  { value: 'auditor', label: 'Auditeur' },
];

export const AVATAR_PALETTE = [
  'bg-rdpc-blue/15 text-rdpc-blue',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-violet-100 text-violet-700',
  'bg-cam-red/15 text-cam-red',
  'bg-fuchsia-100 text-fuchsia-700',
  'bg-slate-200 text-slate-700',
];
