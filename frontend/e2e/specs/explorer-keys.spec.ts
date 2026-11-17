import { test, expect } from '@playwright/test';
import { isEditableTarget, nextFocusIndex } from '../../profiles/tenant-admin/pages/explorerKeys';

// Grille 3 colonnes (6 éléments) puis une seconde grille de 2 éléments plus bas.
const grid = [
  { top: 0, left: 0 }, { top: 0, left: 100 }, { top: 0, left: 200 },
  { top: 80, left: 0 }, { top: 80, left: 100 }, { top: 80, left: 200 },
  { top: 200, left: 0 }, { top: 200, left: 100 },
];

test.describe('Explorateur : déplacement du focus aux flèches', () => {
  test('gauche/droite : précédent/suivant, bloqué en bordure', () => {
    expect(nextFocusIndex(grid, 1, 'ArrowRight')).toBe(2);
    expect(nextFocusIndex(grid, 2, 'ArrowRight')).toBe(3);
    expect(nextFocusIndex(grid, 7, 'ArrowRight')).toBe(7);
    expect(nextFocusIndex(grid, 0, 'ArrowLeft')).toBe(0);
  });

  test('haut/bas : même colonne sur la ligne voisine, y compris entre deux grilles', () => {
    expect(nextFocusIndex(grid, 1, 'ArrowDown')).toBe(4);
    expect(nextFocusIndex(grid, 5, 'ArrowDown')).toBe(7);
    expect(nextFocusIndex(grid, 7, 'ArrowUp')).toBe(4);
    expect(nextFocusIndex(grid, 1, 'ArrowUp')).toBe(1);
    expect(nextFocusIndex(grid, 7, 'ArrowDown')).toBe(7);
  });

  test('tableau (une colonne) : haut/bas = ligne précédente/suivante', () => {
    const rows = [0, 60, 120].map((top) => ({ top, left: 0 }));
    expect(nextFocusIndex(rows, 0, 'ArrowDown')).toBe(1);
    expect(nextFocusIndex(rows, 2, 'ArrowUp')).toBe(1);
  });

  test('sans focus courant : premier élément ; liste vide : -1', () => {
    expect(nextFocusIndex(grid, -1, 'ArrowDown')).toBe(0);
    expect(nextFocusIndex([], 0, 'ArrowDown')).toBe(-1);
  });
});

test.describe('Explorateur : aucun raccourci dans un champ de saisie', () => {
  for (const tagName of ['INPUT', 'TEXTAREA', 'SELECT', 'input']) {
    test(`champ ${tagName}`, () => expect(isEditableTarget({ tagName })).toBe(true));
  }
  test('zone éditable', () => expect(isEditableTarget({ tagName: 'DIV', isContentEditable: true })).toBe(true));
  for (const target of [{ tagName: 'BUTTON' }, { tagName: 'TR' }, null, undefined, {}]) {
    test(`hors saisie ${JSON.stringify(target)}`, () => expect(isEditableTarget(target)).toBe(false));
  }
});
