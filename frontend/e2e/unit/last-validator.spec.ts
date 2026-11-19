// Spec pur (npm run test:unit) : valideur proposé d'office à la soumission.
import { test, expect } from '@playwright/test';
import { pickInitialValidator, readLastValidator, saveLastValidator } from '../../lib/lastValidator';

test.describe('Dernier valideur choisi (lib/lastValidator)', () => {
  test('le dernier valideur est repris s il est toujours proposé', () => {
    expect(pickInitialValidator('v2', ['v1', 'v2'])).toBe('v2');
  });

  test('un valideur qui n est plus proposé est ignoré', () => {
    expect(pickInitialValidator('parti', ['v1', 'v2'])).toBe('');
    expect(pickInitialValidator('parti', ['v1'])).toBe('v1');
  });

  test('sans mémoire : le seul valideur est choisi, sinon rien', () => {
    expect(pickInitialValidator(null, ['v1'])).toBe('v1');
    expect(pickInitialValidator(null, ['v1', 'v2'])).toBe('');
    expect(pickInitialValidator(null, [])).toBe('');
  });

  test('sans stockage navigateur, rien ne casse', () => {
    expect(readLastValidator('u-1')).toBeNull();
    expect(() => saveLastValidator('u-1', 'v1')).not.toThrow();
    expect(readLastValidator(undefined)).toBeNull();
  });
});
