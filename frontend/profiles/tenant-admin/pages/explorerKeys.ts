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

/** Ctrl+clic : ajoute l'élément à la sélection, ou l'en retire. */
export const toggleInSelection = (selection: ReadonlySet<string>, id: string): Set<string> => {
  const next = new Set(selection);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
};

/**
 * Maj+clic : tous les éléments entre l'ancre et la cible, dans l'ordre affiché, comme
 * l'Explorateur Windows. Ancre absente ou disparue : la cible seule.
 */
export const rangeSelection = (orderedIds: readonly string[], anchorId: string | null, id: string): Set<string> => {
  const end = orderedIds.indexOf(id);
  if (end < 0) return new Set();
  const start = anchorId === null ? -1 : orderedIds.indexOf(anchorId);
  if (start < 0) return new Set([id]);
  const [from, to] = start <= end ? [start, end] : [end, start];
  return new Set(orderedIds.slice(from, to + 1));
};

/** Après un rechargement : la sélection ne garde que les éléments encore affichés. */
export const keepDisplayed = (selection: ReadonlySet<string>, orderedIds: readonly string[]): ReadonlySet<string> => {
  const displayed = new Set(orderedIds);
  const kept = [...selection].filter((id) => displayed.has(id));
  return kept.length === selection.size ? selection : new Set(kept);
};

/** Marge entre un menu flottant et le bord de la fenêtre, en px. */
const VIEWPORT_MARGIN_PX = 8;

/**
 * Position d'un menu ouvert au point (x, y), ramenée dans la fenêtre : un clic près du bas
 * ou du bord droit ne doit pas laisser d'entrée hors écran, donc inatteignable.
 */
export const clampToViewport = (
  point: { x: number; y: number },
  menu: { width: number; height: number },
  viewport: { width: number; height: number }
): { top: number; left: number } => ({
  top: Math.max(VIEWPORT_MARGIN_PX, Math.min(point.y, viewport.height - menu.height - VIEWPORT_MARGIN_PX)),
  left: Math.max(VIEWPORT_MARGIN_PX, Math.min(point.x, viewport.width - menu.width - VIEWPORT_MARGIN_PX)),
});
