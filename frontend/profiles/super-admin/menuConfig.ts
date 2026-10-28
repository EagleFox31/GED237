// frontend/profiles/super-admin/menuConfig.ts
import { MenuItem, MenuSection } from '../tenant-admin/menuConfig';

export const SUPER_ADMIN_MENU: MenuSection[] = [
  {
    section: "Plateforme",
    items: [
      { id: 'dashboard', label: 'Dashboard Global', icon: 'dashboard' },
      { id: 'tenants', label: 'Institutions', icon: 'account_balance' },
      { id: 'platform_users', label: 'Utilisateurs', icon: 'manage_accounts' },
      { id: 'authz', label: 'Gestion AuthZ', icon: 'admin_panel_settings' },
    ]
  },
  {
    section: "Contenu",
    items: [
      { id: 'documents', label: 'Documents', icon: 'description' },
      { id: 'tasks', label: 'Workflows', icon: 'account_tree' },
      { id: 'ingestion', label: 'Import en masse', icon: 'drive_folder_upload' },
      { id: 'local_library', label: 'Bibliothèque locale', icon: 'local_library' },
    ]
  },
  {
    section: "Systeme",
    items: [
      { id: 'audit_central', label: 'Audit', icon: 'analytics' },
      { id: 'settings', label: 'Parametres', icon: 'settings' },
    ]
  },
];

export const FLAT_SUPER_ADMIN_MENU: MenuItem[] = SUPER_ADMIN_MENU.flatMap(section => section.items);
