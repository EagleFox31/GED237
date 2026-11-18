import { test, expect } from '@playwright/test';
import { canReassignStep, reassignCandidates } from '../../lib/reassign';

test.describe('Réassigner une étape', () => {
  test('les profils qui assignent voient le bouton sur une étape à traiter', () => {
    for (const profile of ['super', 'tenant', 'unit', 'manager']) {
      expect(canReassignStep(profile, { status: 'current' })).toBe(true);
      expect(canReassignStep(profile, { status: 'pending' })).toBe(true);
    }
  });

  test('ni le collaborateur, ni le lecteur, ni un visiteur sans profil', () => {
    expect(canReassignStep('collab', { status: 'current' })).toBe(false);
    expect(canReassignStep('reader', { status: 'current' })).toBe(false);
    expect(canReassignStep(undefined, { status: 'current' })).toBe(false);
  });

  test('une étape déjà traitée ne se réassigne pas', () => {
    for (const status of ['completed', 'rejected', 'returned', 'skipped', 'pending_assignment']) {
      expect(canReassignStep('tenant', { status })).toBe(false);
    }
  });

  test('la liste propose les autres valideurs, triés par nom', () => {
    const validators = [
      { id: 'c', full_name: 'Zoé Mballa' },
      { id: 'a', full_name: 'Alain Ndongo' },
      { id: 'b', full_name: 'Émile Fotso' },
    ];
    expect(reassignCandidates(validators, 'a').map((v) => v.id)).toEqual(['b', 'c']);
    expect(reassignCandidates(validators, null).map((v) => v.id)).toEqual(['a', 'b', 'c']);
  });
});
