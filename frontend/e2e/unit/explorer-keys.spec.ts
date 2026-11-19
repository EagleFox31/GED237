import { test, expect } from '@playwright/test';
import {
  clampToViewport,
  focusIndexAfterRemoval,
  isEditableTarget,
  isTrashKey,
  nextFocusIndex,
  trashConfirmMessage,
} from '../../profiles/tenant-admin/pages/explorerKeys';

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

test.describe('Explorateur : menu contextuel dans la fenêtre', () => {
  const viewport = { width: 1280, height: 720 };
  const menu = { width: 240, height: 190 };
  test('place libre : le menu s’ouvre au point cliqué', () =>
    expect(clampToViewport({ x: 500, y: 300 }, menu, viewport)).toEqual({ top: 300, left: 500 }));
  test('près du bas : remonté pour que la dernière entrée reste visible', () =>
    expect(clampToViewport({ x: 500, y: 605 }, menu, viewport)).toEqual({ top: 522, left: 500 }));
  test('près du bord droit : décalé vers la gauche', () =>
    expect(clampToViewport({ x: 1200, y: 100 }, menu, viewport)).toEqual({ top: 100, left: 1032 }));
  test('menu plus grand que la fenêtre : collé à la marge haute', () =>
    expect(clampToViewport({ x: 10, y: 400 }, { width: 240, height: 900 }, viewport)).toEqual({ top: 8, left: 10 }));
});

test.describe('Explorateur : Suppr met à la corbeille (#151)', () => {
  const keys = { shiftKey: false, ctrlKey: false, altKey: false, metaKey: false };

  test('Suppr seul déclenche, avec un modificateur non', () => {
    expect(isTrashKey({ key: 'Delete', ...keys })).toBe(true);
    expect(isTrashKey({ key: 'Delete', ...keys, shiftKey: true })).toBe(false);
    expect(isTrashKey({ key: 'Delete', ...keys, ctrlKey: true })).toBe(false);
    expect(isTrashKey({ key: 'Backspace', ...keys })).toBe(false);
  });

  test('question claire, restauration annoncée', () => {
    expect(trashConfirmMessage('Note de service')).toBe(
      'Mettre « Note de service » à la corbeille ? Vous pourrez le restaurer depuis la corbeille.'
    );
  });

  test('le focus passe au voisin, au dernier en fin de liste, nulle part si vide', () => {
    expect(focusIndexAfterRemoval(2, 5)).toBe(2);
    expect(focusIndexAfterRemoval(5, 5)).toBe(4);
    expect(focusIndexAfterRemoval(-1, 3)).toBe(0);
    expect(focusIndexAfterRemoval(0, 0)).toBe(-1);
  });
});
