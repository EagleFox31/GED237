// Filtre de l'arbre des unités : insensible à la casse et aux accents.
export interface FilterableNode {
  name: string;
  children?: FilterableNode[];
}

export const normalizeForSearch = (text: string): string =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/**
 * Garde les unités dont le nom correspond, avec leurs ancêtres (pour qu'elles restent atteignables)
 * et leurs sous-unités. Requête vide : l'arbre est rendu tel quel.
 */
export const filterOrgTree = <T extends FilterableNode>(nodes: T[], query: string): T[] => {
  const q = normalizeForSearch(query);
  if (!q) return nodes;
  const walk = (list: T[]): T[] =>
    list.flatMap((node) => {
      if (normalizeForSearch(node.name).includes(q)) return [node];
      const kept = walk((node.children ?? []) as T[]);
      return kept.length > 0 ? [{ ...node, children: kept }] : [];
    });
  return walk(nodes);
};
