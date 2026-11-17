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

/** Suppr seul (sans Maj, Ctrl, Alt ni Cmd) : mise à la corbeille, jamais suppression définitive (#151). */
export const isTrashKey = (event: {
  key: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
}): boolean => event.key === 'Delete' && !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey;

/** Question posée avant la mise à la corbeille au clavier (une touche est vite pressée par erreur). */
export const trashConfirmMessage = (title: string): string =>
  `Mettre « ${title} » à la corbeille ? Vous pourrez le restaurer depuis la corbeille.`;

/** F2 seul : renommer le document qui a le focus (#151). */
export const isRenameKey = (event: {
  key: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
}): boolean => event.key === 'F2' && !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey;

/** Longueur maximale d'un titre (colonne `documents.title`, String(500)). */
export const TITLE_MAX_LENGTH = 500;

/**
 * Nouveau titre à envoyer, ou null s'il n'y a rien à faire : saisie annulée, vide,
 * identique à l'actuel ou trop longue (le serveur la refuserait).
 */
export const renamedTitle = (input: string | null, current: string): string | null => {
  const title = input?.trim() ?? '';
  if (!title || title === current.trim() || title.length > TITLE_MAX_LENGTH) return null;
  return title;
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
