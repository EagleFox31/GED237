// Libellés humains des codes de rôles seedés (tableau de référence stable ; duplique l'info
// backend, qui pourrait être exposée via /assignable-roles plus tard). Partagé par l'écran
// Utilisateurs et le détail d'un modèle de circuit.
export const ROLE_HUMAN_LABEL: Record<string, string> = {
  super_admin: 'Super-administrateur',
  tenant_admin: 'Admin Ministère',
  unit_admin: 'Admin du service',
  manager: 'Responsable',
  collab: 'Collaborateur',
  reader: 'Lecteur',
  auditor: 'Auditeur',
};
