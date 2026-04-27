// frontend/profiles/tenant-admin/menuConfig.ts
export interface MenuItem {
  id: string;
  label: string;
  icon: string;
  subItems?: string[];
}

export interface MenuSection {
  section: string;
  items: MenuItem[];
}

export const TENANT_ADMIN_MENU: MenuSection[] = [
  {
    section: "Mon Travail",
    items: [
      { id: 'dashboard', label: 'Tableau de bord', icon: 'dashboard', subItems: ['Vue générale', 'Alertes'] },
      { id: 'needs_review', label: 'Ma bannette', icon: 'inbox', subItems: ['Documents à revoir', 'En attente de ma signature'] },
      { id: 'pending_assignments', label: 'À distribuer', icon: 'assignment_ind', subItems: ['Documents sans destinataire'] },
      { id: 'search_config', label: 'Recherche', icon: 'manage_search', subItems: ['Recherche plein texte', 'Recherche avancée'] },
    ]
  },
  {
    section: "Mon Organisation",
    items: [
      { id: 'org', label: 'Structure hiérarchique', icon: 'corporate_fare', subItems: ['Organigramme', 'Annuaire des services'] },
      { id: 'spaces', label: 'Services & Espaces', icon: 'folder_managed', subItems: ['Espaces par service', 'Espaces projets'] },
      { id: 'users', label: 'Agents & Rôles', icon: 'group', subItems: ['Liste des agents', 'Rôles & permissions', 'Groupes'] },
    ]
  },
  {
    section: "Configuration GED",
    items: [
      { id: 'ged_rules', label: 'Paramétrage', icon: 'tune', subItems: ['Types de documents', 'Circuits de validation', "Règles d'aiguillage", 'Simulateur'] },
      { id: 'ingestion', label: 'Import en masse', icon: 'drive_folder_upload', subItems: ['Scanner un dossier', 'Classement automatique'] },
    ]
  },
  {
    section: "Administration",
    items: [
      { id: 'security_config', label: 'Accès & Permissions', icon: 'shield_lock', subItems: ["Politiques d'accès", 'Confidentialité', 'Archivage'] },
      { id: 'audit_central', label: 'Audit & Traçabilité', icon: 'analytics', subItems: ['Journal des actions', 'Historique documents'] },
      { id: 'reports', label: 'Rapports & Statistiques', icon: 'legend_toggle', subItems: ['Statistiques', 'Exports'] },
      { id: 'settings', label: 'Paramètres', icon: 'settings', subItems: ['Général', 'Notifications', 'Intégrations'] },
    ]
  }
];

// Helper pour obtenir une liste plate pour la TopBar
export const FLAT_TENANT_MENU = TENANT_ADMIN_MENU.flatMap(section => section.items);
