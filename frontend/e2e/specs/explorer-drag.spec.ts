// Spec pur (npm run test:unit) : glisser un document sur un dossier ouvre « Classer » (#299).
import { test, expect } from '@playwright/test';
import {
  DOCUMENT_DRAG_TYPE,
  canClassify,
  currentUnitOf,
  dropTargetUnit,
  isDocumentDrag,
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
