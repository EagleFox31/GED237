// Périmètre réglable par rôle (contrat 9.5 / 9.6 de l'instruction de l'élément 13).
// Module pur : libellés, options de la liste déroulante et messages d'erreur.
export const SCOPES = ['own', 'unit', 'unit_tree', 'tenant'] as const;
export type Scope = (typeof SCOPES)[number];

export interface AccessScopeRow {
  role: string;
  resource: string;
  scope: Scope;
  default: Scope;
  ceiling: Scope;
  overridden: boolean;
}

export const SCOPE_LABEL: Record<Scope, string> = {
  own: 'Ses documents',
  unit: 'Son unité',
  unit_tree: 'Son unité et ses sous-unités',
  tenant: "Toute l'institution",
};

export interface ScopeOption {
  value: Scope;
  label: string;
  disabled: boolean;
}

const rank = (s: Scope): number => SCOPES.indexOf(s);

/** Quatre choix ; « (par défaut) » sur la valeur par défaut ; au-dessus du plafond : grisé. */
export const scopeOptions = (row: Pick<AccessScopeRow, 'default' | 'ceiling'>): ScopeOption[] =>
  SCOPES.map((value) => ({
    value,
    label: value === row.default ? `${SCOPE_LABEL[value]} (par défaut)` : SCOPE_LABEL[value],
    disabled: rank(value) > rank(row.ceiling),
  }));

export const isScope = (v: unknown): v is Scope => typeof v === 'string' && (SCOPES as readonly string[]).includes(v);

/** Écarte une ligne mal formée plutôt que d'afficher une liste fausse. */
export const parseAccessScopes = (raw: unknown): AccessScopeRow[] => {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((r): AccessScopeRow[] => {
    if (typeof r !== 'object' || r === null) return [];
    const o = r as Record<string, unknown>;
    if (typeof o.role !== 'string' || typeof o.resource !== 'string') return [];
    if (!isScope(o.scope) || !isScope(o.default) || !isScope(o.ceiling)) return [];
    return [{ role: o.role, resource: o.resource, scope: o.scope, default: o.default, ceiling: o.ceiling, overridden: o.overridden === true }];
  });
};

export const rowKey = (row: Pick<AccessScopeRow, 'role' | 'resource'>): string => `${row.role}|${row.resource}`;

/** Remplace la ligne mise à jour, sans toucher aux autres. */
export const applyScopeUpdate = (rows: AccessScopeRow[], updated: AccessScopeRow): AccessScopeRow[] =>
  rows.map((r) => (rowKey(r) === rowKey(updated) ? updated : r));

export const ACCESS_SCOPES_LOAD_FAILED = 'Chargement des périmètres impossible. Réessayez plus tard.';

/** Message d'un changement refusé, choisi par le code HTTP (jamais le texte du serveur). */
export const accessScopeChangeError = (status?: number): string => {
  if (status === 403) return "Vous n'avez pas le droit de changer les périmètres.";
  if (status === 422) return 'Ce périmètre est trop large pour ce rôle.';
  return 'Changement impossible pour le moment.';
};
