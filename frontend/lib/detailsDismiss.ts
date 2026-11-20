import { useEffect, type RefObject } from 'react';

/**
 * Ferme un `<details>` utilisé comme menu déroulant : Échap (le focus revient sur le
 * `<summary>`) ou un clic en dehors. Le `<details>` reste une zone dépliable native :
 * pas de rôle `menu`, qui promettrait une navigation aux flèches.
 */
export const useDetailsDismiss = (
  detailsRef: RefObject<HTMLDetailsElement | null>,
  summaryRef: RefObject<HTMLElement | null>,
): void => {
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const details = detailsRef.current;
      if (details?.open && !details.contains(event.target as Node)) details.open = false;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const details = detailsRef.current;
      if (event.key !== 'Escape' || !details?.open) return;
      const hadFocus = details.contains(document.activeElement);
      details.open = false;
      if (hadFocus) summaryRef.current?.focus();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [detailsRef, summaryRef]);
};
