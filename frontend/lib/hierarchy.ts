// Rattachement d'un agent (#277) : règles d'affichage sans React, testées par `npm run test:unit`.

/** Personne renvoyée par GET /users/{id}/hierarchy-up et hierarchy-down (extrait de UserRead). */
export interface HierarchyPerson {
  id: string;
  full_name: string;
  matricule: string;
  role_label?: string | null;
}

export type ChainEntry =
  | { kind: 'person'; person: HierarchyPerson; level: number }
  | { kind: 'more'; count: number };

/** Au-delà de ce nombre de chefs, les intermédiaires se replient en « … ». */
export const CHAIN_VISIBLE_MAX = 3;

/**
 * Chaîne des chefs, du N+1 au plus haut. Repliée : N+1, « … », plus haut.
 * `level` vaut 1 pour le N+1, 2 pour le N+2, etc.
 */
export const chainEntries = (chain: readonly HierarchyPerson[], expanded: boolean): ChainEntry[] => {
  const all: ChainEntry[] = chain.map((person, index) => ({ kind: 'person', person, level: index + 1 }));
  const first = all[0];
  const last = all.at(-1);
  if (expanded || chain.length <= CHAIN_VISIBLE_MAX || !first || !last) return all;
  return [first, { kind: 'more', count: chain.length - 2 }, last];
};

export const teamCountLabel = (count: number): string => (count > 1 ? `${count} personnes` : `${count} personne`);

/**
 * Message du bloc selon le code HTTP ; jamais le texte du serveur.
 * « Agent introuvable. » n'a de sens que sur la fiche d'un agent, pas sur « Mon équipe ».
 */
export const hierarchyErrorMessage = (status: number | undefined, variant: 'self' | 'agent' = 'agent'): string =>
  status === 404 && variant === 'agent' ? 'Agent introuvable.' : 'Rattachement indisponible pour le moment.';

export const errorStatus = (error: unknown): number | undefined => {
  if (typeof error !== 'object' || error === null) return undefined;
  const { status } = error as { status?: unknown };
  return typeof status === 'number' ? status : undefined;
};

/** Profondeur maximale dépliable sous une personne (garde-fou contre une chaîne cyclique côté données). */
export const TEAM_DEPTH_MAX = 6;

/** Niveau sous la personne connectée : 1 = N-1 (équipe directe), 2 = N-2, etc. */
export const teamLevelLabel = (depth: number): string => `N-${depth}`;

/** Libellé du bouton qui déplie l'équipe d'une personne. */
export const teamToggleLabel = (name: string, open: boolean): string =>
  open ? `Replier l'équipe de ${name}` : `Voir l'équipe de ${name}`;

/** Un nœud peut-il encore être déplié ? Au-delà de TEAM_DEPTH_MAX, on s'arrête. */
export const canExpand = (depth: number): boolean => depth < TEAM_DEPTH_MAX;

/** Évite qu'une boucle de rattachement (A → B → A) se déplie à l'infini : un ancêtre déjà affiché n'est plus proposé. */
export const withoutAncestors = (people: readonly HierarchyPerson[], ancestorIds: readonly string[]): HierarchyPerson[] =>
  people.filter((p) => !ancestorIds.includes(p.id));
