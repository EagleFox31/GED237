// Spec pur (npm run test:unit) : mémorisation du valideur dans DraftWorkspace (Lot 4, point 1).
import { test, expect } from '@playwright/test';
import {
  readStoredValidator,
  resolveInitialValidator,
  writeStoredValidator,
} from '../../lib/draftWorkspace';
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

test.describe('Mémorisation du dernier valideur (DraftWorkspace)', () => {
  test('mémorise le dernier valideur par utilisateur et résiste aux erreurs de stockage', () => {
    const storage = createMemoryStorage();
    writeStoredValidator('val-1', 't1:MINFI002', storage);
    expect(readStoredValidator('t1:MINFI002', storage)).toBe('val-1');
    expect(readStoredValidator('t2:MINESUP001', storage)).toBe('');

    const broken: KeyValueStorage = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => {
        throw new Error('SecurityError');
      },
    };
    expect(() => writeStoredValidator('val-1', 't1:MINFI002', broken)).not.toThrow();
    expect(readStoredValidator('t1:MINFI002', broken)).toBe('');
  });

  test('sélectionne automatiquement un valideur unique, sinon reprend le valideur mémorisé s il existe encore', () => {
    expect(resolveInitialValidator([{ id: 'only-one' }], '')).toBe('only-one');
    expect(resolveInitialValidator([{ id: 'only-one' }], 'old-id')).toBe('only-one');

    const list = [{ id: 'v1' }, { id: 'v2' }];
    expect(resolveInitialValidator(list, 'v2')).toBe('v2');
    expect(resolveInitialValidator(list, 'supprime')).toBe('');
    expect(resolveInitialValidator(list, '')).toBe('');
  });
});
