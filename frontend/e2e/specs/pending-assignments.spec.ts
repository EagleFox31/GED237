// Spec pur (npm run test:unit) : assignations en série, filtre d'acteurs et étape suivante (Lot 4, point 5).
import { test, expect } from '@playwright/test';
import {
  filterAssignableUsers,
  pickNextAssignment,
  readStoredActorId,
  resolveInitialActorId,
  writeStoredActorId,
} from '../../lib/pendingAssignments';
import type { KeyValueStorage } from '../../lib/userPreferences';

function createMemoryStorage(): KeyValueStorage {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => map.set(key, value),
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

test.describe('Assignations manuelles en série (PendingAssignmentsInbox)', () => {
  test('mémorise le dernier acteur par utilisateur et ignore un id disparu', () => {
    const storage = createMemoryStorage();
    writeStoredActorId('u-42', 't1:ADMIN', storage);
    expect(readStoredActorId('t1:ADMIN', storage)).toBe('u-42');
    expect(resolveInitialActorId([{ id: 'u-1' }, { id: 'u-42' }], 'u-42')).toBe('u-42');
    expect(resolveInitialActorId([{ id: 'u-1' }], 'u-42')).toBe('');
  });

  test('filtre la liste des acteurs par nom ou rôle', () => {
    const users = [
      { id: '1', full_name: 'Paul Mbarga', role_label: 'Sous-Directeur' },
      { id: '2', full_name: 'Aline Nguema', role_label: 'Chef de Service' },
    ];
    expect(filterAssignableUsers(users, '').length).toBe(2);
    expect(filterAssignableUsers(users, 'aline').map((u) => u.id)).toEqual(['2']);
    expect(filterAssignableUsers(users, 'directeur').map((u) => u.id)).toEqual(['1']);
  });

  test('passe automatiquement à l étape suivante après assignation', () => {
    const items = [{ id: 'a1' }, { id: 'a2' }, { id: 'a3' }];
    expect(pickNextAssignment(items, 'a1')?.id).toBe('a2');
    expect(pickNextAssignment(items, 'a2')?.id).toBe('a3');
    expect(pickNextAssignment(items, 'a3')?.id).toBe('a2');
    expect(pickNextAssignment([{ id: 'a1' }], 'a1')).toBeNull();
  });
});
