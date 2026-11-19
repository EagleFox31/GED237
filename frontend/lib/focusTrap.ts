// Garde du focus dans une fenêtre modale : Tab et Maj+Tab tournent sur ses éléments.

export const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export const FIELD_SELECTOR = 'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled])';

/**
 * Index à focaliser quand Tab sort de la fenêtre, ou null pour laisser le navigateur avancer.
 * `current` vaut -1 quand le focus n'est sur aucun élément de la fenêtre.
 */
export const wrapFocusIndex = (current: number, count: number, backwards: boolean): number | null => {
  if (count === 0) return null;
  if (current < 0) return backwards ? count - 1 : 0;
  if (backwards && current === 0) return count - 1;
  if (!backwards && current === count - 1) return 0;
  return null;
};

/**
 * À la fermeture, rendre le focus à l'élément d'origine seulement si personne ne l'a déjà placé
 * ailleurs (un écran peut viser un autre élément, par exemple le voisin d'un élément supprimé).
 */
export const shouldRestoreFocus = (
  opener: { isConnected: boolean } | null,
  active: Element | null,
  body: Element | null,
): boolean => opener !== null && opener.isConnected && (active === null || active === body);
