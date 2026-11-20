import { test, expect } from '@playwright/test';

import type { Document } from '../../types';
import { PLACEMENT_KEYS, canUndoMove, moveToUnitPatch, placementOf } from '../../lib/undo/placement';

const doc = (over: Partial<Document>): Document => ({ id: 'd1', title: 'Note', org_unit_id: 'u-root', ...over }) as Document;

test.describe('Annuler un déplacement : règles d’emplacement (#151)', () => {
  test('instantané : les sept champs, null quand absents', () => {
    const before = placementOf(doc({ classification_target_org_unit_id: 'u1', classification_scope: 'service' }));
    expect(Object.keys(before).sort()).toEqual([...PLACEMENT_KEYS].sort());
    expect(before.classification_target_org_unit_id).toBe('u1');
    expect(before.classification_domain_id).toBeNull();
  });

  test('déposer dans le dossier où il est déjà : rien à faire', () => {
    expect(moveToUnitPatch(doc({ classification_target_org_unit_id: 'u1' }), 'u1')).toBeNull();
    expect(moveToUnitPatch(doc({}), 'u-root')).toBeNull();
  });

  test('déposer ailleurs : unité cible, portée gardée, personne retirée', () => {
    expect(moveToUnitPatch(doc({ classification_scope: 'directorate' }), 'u2')).toEqual({
      classification_target_org_unit_id: 'u2',
      classification_scope: 'directorate',
      classification_target_user_id: null,
    });
    expect(moveToUnitPatch(doc({ classification_scope: 'person', classification_target_user_id: 'p1' }), 'u2'))
      .toMatchObject({ classification_scope: 'service', classification_target_user_id: null });
  });

  test('Annuler proposé seulement si le retour est sûr', () => {
    const patch = { classification_scope: 'service' as const };
    expect(canUndoMove(placementOf(doc({ classification_target_org_unit_id: 'u1', classification_scope: 'service' })), patch)).toBe(true);
    expect(canUndoMove(placementOf(doc({})), patch)).toBe(false);
    expect(canUndoMove(placementOf(doc({ classification_target_org_unit_id: 'u1', classification_scope: 'person' })), patch)).toBe(false);
    expect(
      canUndoMove(placementOf(doc({ classification_target_org_unit_id: 'u1' })), { classification_scope: 'person' }),
    ).toBe(false);
  });
});
