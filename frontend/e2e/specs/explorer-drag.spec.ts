// Spec pur (npm run test:unit) : glisser un document sur un dossier ouvre « Classer » (#299).
import { test, expect } from '@playwright/test';
import {
  DOCUMENT_DRAG_TYPE,
  canClassify,
  currentUnitOf,
  dropTargetUnit,
  droppedFiles,
  filesDropVerdict,
  isFileDrag,
  isDocumentDrag,
  titleFromFileName,
} from '../../lib/explorerDrag';

test.describe('Explorateur : glisser pour classer', () => {
  test('seul un document de l’explorateur déclenche le dépôt', () => {
    expect(isDocumentDrag([DOCUMENT_DRAG_TYPE])).toBe(true);
    expect(isDocumentDrag(['Files'])).toBe(false);
    expect(isDocumentDrag(['text/plain'])).toBe(false);
    expect(isDocumentDrag([])).toBe(false);
  });

  test('même règle que le menu « Classer »', () => {
    expect(canClassify(undefined)).toBe(true);
    expect(canClassify(null)).toBe(true);
    expect(canClassify('pending')).toBe(true);
    expect(canClassify('needs_review')).toBe(true);
    expect(canClassify('classified')).toBe(false);
    expect(canClassify('rejected')).toBe(false);
  });

  test('service actuel : la cible de classement prime sur le service de dépôt', () => {
    expect(currentUnitOf({ classification_target_org_unit_id: 'u2', org_unit_id: 'u1' })).toBe('u2');
    expect(currentUnitOf({ classification_target_org_unit_id: null, org_unit_id: 'u1' })).toBe('u1');
    expect(currentUnitOf({})).toBeNull();
  });

  test('déposer dans son propre dossier ne fait rien', () => {
    expect(dropTargetUnit('u1', 'u1')).toBeNull();
    expect(dropTargetUnit('u1', 'u2')).toBe('u2');
    expect(dropTargetUnit(null, 'u2')).toBe('u2');
    expect(dropTargetUnit('u1', '')).toBeNull();
    expect(dropTargetUnit('u1', undefined)).toBeNull();
  });
});

test.describe('Explorateur : fichiers glissés depuis Windows (élément 20)', () => {
  test('Windows (Files) se distingue du reclassement interne', () => {
    expect(isFileDrag(['Files'])).toBe(true);
    expect(isFileDrag(['text/plain'])).toBe(false);
    expect(isFileDrag([DOCUMENT_DRAG_TYPE, 'Files'])).toBe(false);
    expect(isDocumentDrag(['Files'])).toBe(false);
  });

  test('droits : import réservé aux profils autorisés, collaborateur un fichier à la fois', () => {
    expect(filesDropVerdict('tenant', 3)).toEqual({ ok: true });
    expect(filesDropVerdict('collab', 1)).toEqual({ ok: true });
    expect(filesDropVerdict('collab', 2)).toEqual({ ok: false, message: 'Un fichier à la fois.' });
    expect(filesDropVerdict('reader', 1)).toEqual({ ok: false, message: 'Vous ne pouvez pas déposer ici.' });
    expect(filesDropVerdict(undefined, 1).ok).toBe(false);
    expect(filesDropVerdict('tenant', 0)).toEqual({ ok: false, message: 'Glissez les fichiers, pas le dossier.' });
  });

  test('un dossier glissé (taille et type vides) n\'est pas un fichier', () => {
    const real = new File(['abc'], 'a.txt', { type: 'text/plain' });
    const folder = new File([], 'Dossier', { type: '' });
    expect(droppedFiles([real, folder])).toEqual([real]);
  });
});

test('le titre proposé est le nom du fichier sans son extension', () => {
  expect(titleFromFileName('Courrier 2026.pdf')).toBe('Courrier 2026');
  expect(titleFromFileName('archive.tar.gz')).toBe('archive.tar');
  expect(titleFromFileName('sans-extension')).toBe('sans-extension');
});
