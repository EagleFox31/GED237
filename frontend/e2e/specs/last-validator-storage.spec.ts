// Spec pur (npm run test:unit) : mémorisation du dernier valideur par utilisateur.
import { test, expect } from '@playwright/test';
import {
  lastValidatorKey,
  readLastValidatorId,
  writeLastValidatorId,
} from '../../lib/lastValidatorStorage';

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => { map.set(k, v); },
  };
}

test.describe('Dernier valideur pré-sélectionné (DraftWorkspace)', () => {
  test('mémorise et relit le dernier valideur par organisation et matricule', () => {
    const storage = memoryStorage();
    const a = { tenantId: 'tenant-1', matricule: 'MAT001' };
    const b = { tenantId: 'tenant-1', matricule: 'MAT002' };

    writeLastValidatorId(a, 'val-123', storage);
    writeLastValidatorId(b, 'val-999', storage);

    expect(lastValidatorKey(a)).not.toBe(lastValidatorKey(b));
    expect(readLastValidatorId(a, storage)).toBe('val-123');
    expect(readLastValidatorId(b, storage)).toBe('val-999');
  });

  test('le même matricule dans une autre organisation ne relit pas le choix', () => {
    const storage = memoryStorage();
    writeLastValidatorId({ tenantId: 'tenant-1', matricule: 'MAT001' }, 'val-123', storage);

    expect(lastValidatorKey({ tenantId: 'tenant-1', matricule: 'MAT001' })).toContain('tenant-1');
    expect(readLastValidatorId({ tenantId: 'tenant-2', matricule: 'MAT001' }, storage)).toBe('');
  });

  test('ne mémorise rien sans organisation ou sans matricule', () => {
    const storage = memoryStorage();
    writeLastValidatorId({ tenantId: 'tenant-1' }, 'val-1', storage);
    writeLastValidatorId({ matricule: 'MAT001' }, 'val-2', storage);
    writeLastValidatorId(null, 'val-3', storage);

    expect(storage.map.size).toBe(0);
    expect(lastValidatorKey({ tenantId: ' ', matricule: 'MAT001' })).toBeNull();
    expect(readLastValidatorId(null, storage)).toBe('');
  });

  test('assure un repli silencieux si localStorage lève une erreur', () => {
    const brokenStorage = {
      getItem: () => { throw new Error('QuotaExceededError'); },
      setItem: () => { throw new Error('SecurityError'); },
    };
    const owner = { tenantId: 'tenant-1', matricule: 'MAT001' };

    expect(() => writeLastValidatorId(owner, 'val-1', brokenStorage)).not.toThrow();
    expect(readLastValidatorId(owner, brokenStorage)).toBe('');
  });
});
