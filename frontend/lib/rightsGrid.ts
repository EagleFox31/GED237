// Grille des droits (#280, lot 8b) : logique pure, testée par `npm run test:unit`
// (e2e/specs/rights-grid.spec.ts). Une case cochée = une règle `p, rôle, ressource, action`,
// la même que dans policy.csv ou en base : l'écran ne crée pas de second modèle de droits.
import { ROLE_HUMAN_LABEL } from './roleLabels';

export interface PolicyRow {
  ptype?: string;
  v0: string;
  v1: string;
  v2: string;
  v3?: string | null;
}

/** Action Casbin qui couvre toutes les autres (matcher : `p.act == "manage"`). */
export const MANAGE = 'manage';

const RESOURCE_LABEL: Record<string, string> = {
  'analytics.platform': 'Statistiques de la plateforme',
  'analytics.tenant': 'Statistiques du ministère',
  audit_logs: "Journal d'audit",
  categories: 'Types de documents',
  classification_reviews: 'Documents à revoir',
  classification_rules: 'Règles de classement',
  documents: 'Documents',
  'gedrules.rules': "Règles d'aiguillage",
  'gedrules.templates': 'Circuits de validation',
  org_units: 'Services',
  spaces: 'Explorateur',
  tenants: 'Ministères',
  users: 'Agents',
  workflows: 'Validations',
};

// Ordre des colonnes : du plus courant au plus large.
const ACTION_LABEL: Record<string, string> = {
  read: 'Consulter',
  read_own: 'Consulter les siens',
  create: 'Créer',
  update: 'Modifier',
  update_own: 'Modifier les siens',
  trash_own: 'Mettre les siens à la corbeille',
  delete: 'Supprimer',
  delete_own: 'Supprimer les siens',
  archive: 'Archiver',
  assign: 'Attribuer',
  review: 'Revoir',
  resolve_review: 'Valider ou rejeter',
  simulate: 'Simuler',
  [MANAGE]: 'Tout gérer',
};
const ACTION_ORDER = Object.keys(ACTION_LABEL);

/** Colonnes toujours proposées, même sans règle pour la ressource. */
const BASE_ACTIONS = ['read', 'create', 'update', 'delete', MANAGE];

// Codes absents de la table partagée (policy.csv écrit `collaborator`).
const EXTRA_ROLE_LABEL: Record<string, string> = { collaborator: 'Collaborateur' };
const ROLE_ORDER = ['super_admin', 'tenant_admin', 'unit_admin', 'manager', 'collaborator', 'collab', 'reader', 'auditor'];

export const resourceLabel = (code: string): string => RESOURCE_LABEL[code] ?? `(${code})`;
export const actionLabel = (code: string): string => ACTION_LABEL[code] ?? `(${code})`;
export const roleLabel = (code: string): string => ROLE_HUMAN_LABEL[code] ?? EXTRA_ROLE_LABEL[code] ?? `(${code})`;

export const policyKey = (role: string, resource: string, action: string): string => `${role}|${resource}|${action}`;

/** Règles `p` à trois valeurs, les seules que la grille sait représenter. */
const isGridRule = (p: PolicyRow): boolean => (p.ptype ?? 'p') === 'p' && !p.v3 && !!p.v0 && !!p.v1 && !!p.v2;

const rankIn = (order: string[], code: string): number => {
  const index = order.indexOf(code);
  return index < 0 ? order.length : index;
};

const byRankThenCode = (order: string[]) => (a: string, b: string): number =>
  rankIn(order, a) - rankIn(order, b) || a.localeCompare(b);

export const grantedKeys = (policies: PolicyRow[]): Set<string> =>
  new Set(policies.filter(isGridRule).map((p) => policyKey(p.v0, p.v1, p.v2)));

/** Ressources présentes dans les règles, triées par libellé. */
export const resourcesOf = (policies: PolicyRow[]): string[] =>
  Array.from(new Set(policies.filter(isGridRule).map((p) => p.v1))).sort((a, b) =>
    resourceLabel(a).localeCompare(resourceLabel(b), 'fr')
  );

export type CellState = 'granted' | 'implied' | 'none';

export interface RightsGrid {
  roles: string[];
  actions: string[];
  cell: (role: string, action: string) => CellState;
}

/**
 * Grille d'une ressource : lignes = rôles (ceux des règles, plus `extraRoles`),
 * colonnes = actions de base plus celles déjà utilisées pour la ressource.
 * Une action couverte par « Tout gérer » est `implied` : effective sans règle propre.
 */
export const gridFor = (resource: string, policies: PolicyRow[], extraRoles: string[] = []): RightsGrid => {
  const rules = policies.filter(isGridRule);
  const granted = grantedKeys(rules);
  const roles = Array.from(new Set([...rules.map((p) => p.v0), ...extraRoles])).sort(byRankThenCode(ROLE_ORDER));
  const actions = Array.from(
    new Set([...BASE_ACTIONS, ...rules.filter((p) => p.v1 === resource).map((p) => p.v2)])
  ).sort(byRankThenCode(ACTION_ORDER));
  return {
    roles,
    actions,
    cell: (role, action) => {
      if (granted.has(policyKey(role, resource, action))) return 'granted';
      if (action !== MANAGE && granted.has(policyKey(role, resource, MANAGE))) return 'implied';
      return 'none';
    },
  };
};

/** Liste locale après un ajout ou un retrait réussi (sans doublon, sans relire tout le serveur). */
export const applyChange = (policies: PolicyRow[], rule: PolicyRow, granted: boolean): PolicyRow[] => {
  const key = policyKey(rule.v0, rule.v1, rule.v2);
  const others = policies.filter((p) => !(isGridRule(p) && policyKey(p.v0, p.v1, p.v2) === key));
  return granted ? [...others, { ptype: 'p', v0: rule.v0, v1: rule.v1, v2: rule.v2 }] : others;
};

export const RIGHTS_READ_ONLY_TENANT = 'Lecture seule : seul le super-administrateur change les droits.';
export const RIGHTS_READ_ONLY_SERVER = 'Lecture seule sur cette installation : les droits se règlent sur le serveur.';
export const RIGHTS_LOAD_FAILED = 'Chargement des droits impossible. Réessayez plus tard.';

/** Message d'un changement refusé, choisi par le code HTTP (jamais le texte du serveur). */
export const rightsChangeError = (status?: number): string => {
  if (status === 403) return 'Seul le super-administrateur peut changer les droits.';
  if (status === 409) return RIGHTS_READ_ONLY_SERVER;
  if (status === 422) return "Ce droit n'existe pas.";
  if (status === 429) return "Trop de changements d'un coup. Réessayez dans une minute.";
  return 'Changement impossible pour le moment.';
};
