// Réflexes clavier de l'explorateur (façon Explorateur Windows) : logique pure, sans DOM,
// testée par `npm run test:unit` (e2e/specs/explorer-keys.spec.ts).

export type ArrowKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown';

export const isArrowKey = (key: string): key is ArrowKey =>
  key === 'ArrowLeft' || key === 'ArrowRight' || key === 'ArrowUp' || key === 'ArrowDown';

/** Vrai si la touche doit rester au champ de saisie (aucun raccourci ne s'y déclenche). */
export const isEditableTarget = (target: unknown): boolean => {
  const el = target as { tagName?: string; isContentEditable?: boolean } | null;
  if (!el || typeof el.tagName !== 'string') return false;
  return Boolean(el.isContentEditable) || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName.toUpperCase());
};

export interface ItemBox {
  top: number;
  left: number;
}

// Tolérance (px) pour considérer deux éléments sur la même ligne malgré les arrondis de rendu.
const SAME_ROW_PX = 2;

/**
 * Index de l'élément qui reçoit le focus après une flèche, dans l'ordre du DOM.
 * Gauche/droite : élément précédent/suivant. Haut/bas : ligne visuelle voisine,
 * élément le plus proche horizontalement (fonctionne pour une grille comme pour un tableau).
 * Reste sur place en bordure.
 */
export const nextFocusIndex = (boxes: ItemBox[], current: number, key: ArrowKey): number => {
  if (boxes.length === 0) return -1;
  if (current < 0 || current >= boxes.length) return 0;
  if (key === 'ArrowLeft') return Math.max(current - 1, 0);
  if (key === 'ArrowRight') return Math.min(current + 1, boxes.length - 1);

  const origin = boxes[current];
  if (!origin) return current;
  const down = key === 'ArrowDown';
  const candidates = boxes
    .map((box, index) => ({ box, index }))
    .filter(({ box }) => (down ? box.top > origin.top + SAME_ROW_PX : box.top < origin.top - SAME_ROW_PX));
  if (candidates.length === 0) return current;

  const rowTop = down
    ? Math.min(...candidates.map(({ box }) => box.top))
    : Math.max(...candidates.map(({ box }) => box.top));
  const row = candidates.filter(({ box }) => Math.abs(box.top - rowTop) <= SAME_ROW_PX);
  return row.reduce((best, c) =>
    Math.abs(c.box.left - origin.left) < Math.abs(best.box.left - origin.left) ? c : best
  ).index;
};
