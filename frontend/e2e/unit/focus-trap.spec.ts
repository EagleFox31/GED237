import { test, expect } from '@playwright/test';
import { shouldRestoreFocus, wrapFocusIndex } from '../../lib/focusTrap';

test.describe('focusTrap', () => {
  test('Tab tourne : du dernier au premier, Maj+Tab du premier au dernier', () => {
    expect(wrapFocusIndex(2, 3, false)).toBe(0);
    expect(wrapFocusIndex(0, 3, true)).toBe(2);
  });

  test('au milieu, le navigateur avance seul', () => {
    expect(wrapFocusIndex(0, 3, false)).toBeNull();
    expect(wrapFocusIndex(1, 3, true)).toBeNull();
  });

  test('focus hors de la fenêtre : il y revient', () => {
    expect(wrapFocusIndex(-1, 3, false)).toBe(0);
    expect(wrapFocusIndex(-1, 3, true)).toBe(2);
    expect(wrapFocusIndex(-1, 0, false)).toBeNull();
  });

  test('retour du focus : seulement si personne ne l’a placé ailleurs', () => {
    const body = { id: 'body' } as unknown as Element;
    const other = { id: 'voisin' } as unknown as Element;
    const opener = { isConnected: true };
    expect(shouldRestoreFocus(opener, body, body)).toBe(true);
    expect(shouldRestoreFocus(opener, null, body)).toBe(true);
    expect(shouldRestoreFocus(opener, other, body)).toBe(false);
    expect(shouldRestoreFocus({ isConnected: false }, body, body)).toBe(false);
    expect(shouldRestoreFocus(null, body, body)).toBe(false);
  });
});
