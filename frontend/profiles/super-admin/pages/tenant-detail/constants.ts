export { ROLE_LABELS, ROLE_BADGE_STYLES, ROLES, AVATAR_PALETTE } from '../../../../constants/roles';

export const PAGE_SIZE = 10;

export const STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  in_review: 'En revue',
  validated: 'Validé',
  approved: 'Approuvé',
  rejected: 'Rejeté',
  archived: 'Archivé',
  trashed: 'Corbeille',
};

export const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  in_review: 'bg-amber-50 text-amber-700',
  validated: 'bg-green-50 text-green-700',
  approved: 'bg-green-50 text-green-700',
  rejected: 'bg-red-50 text-red-700',
  archived: 'bg-violet-50 text-violet-700',
  trashed: 'bg-slate-100 text-slate-500',
};

export const TABS = [
  { id: 'summary', label: 'Résumé', icon: 'dashboard' },
  { id: 'admins', label: 'Admins', icon: 'admin_panel_settings' },
  { id: 'users', label: 'Utilisateurs', icon: 'group' },
  { id: 'services', label: 'Services', icon: 'account_tree' },
  { id: 'workflows', label: 'Workflows', icon: 'flowchart' },
] as const;
