// Spec pur (npm run test:unit) : mémorisation du dernier valideur par utilisateur.
import { test, expect } from '@playwright/test';
import {
  lastValidatorKey,
  readLastValidatorId,
  writeLastValidatorId,
} from '../../lib/lastValidatorStorage';

test.describe('Dernier valideur pré-sélectionné (DraftWorkspace)', () => {
  test('mémorise et relit le dernier valideur par clé utilisateur', () => {
    const map = new Map<string, string>();
    const storage = {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => { map.set(k, v); },
    };

    writeLastValidatorId('MAT001', 'val-123', storage);
    writeLastValidatorId('MAT002', 'val-999', storage);

    expect(lastValidatorKey('MAT001')).not.toBe(lastValidatorKey('MAT002'));
    expect(readLastValidatorId('MAT001', storage)).toBe('val-123');
    expect(readLastValidatorId('MAT002', storage)).toBe('val-999');
  });

  test('assure un repli silencieux si localStorage lève une erreur', () => {
    const brokenStorage = {
      getItem: () => { throw new Error('QuotaExceededError'); },
      setItem: () => { throw new Error('SecurityError'); },
    };

    expect(() => writeLastValidatorId('MAT001', 'val-1', brokenStorage)).not.toThrow();
    expect(readLastValidatorId('MAT001', brokenStorage)).toBe('');
  });
});
