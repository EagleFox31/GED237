// Spec pur (npm run test:unit) : mémorisation de la destination dans NeedsReviewInbox (Lot 4, point 6).
import { test, expect } from '@playwright/test';
import {
  readStoredDestination,
  resolveInitialDestination,
  writeStoredDestination,
} from '../../lib/needsReviewDestination';
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

test.describe('Mémorisation de la destination (NeedsReviewInbox)', () => {
  test('mémorise la destination par utilisateur et l ignore si le service n existe plus', () => {
    const storage = createMemoryStorage();
    writeStoredDestination('ou-daf', 't1:ADMIN', storage);
    expect(readStoredDestination('t1:ADMIN', storage)).toBe('ou-daf');
    expect(readStoredDestination('t2:ADMIN', storage)).toBe('');

    expect(resolveInitialDestination([{ id: 'ou-daf' }, { id: 'ou-rh' }], 'ou-daf')).toBe('ou-daf');
    expect(resolveInitialDestination([{ id: 'ou-rh' }], 'ou-daf')).toBe('');
  });
});
