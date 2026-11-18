// Spec pur (npm run test:unit) : visibilité des profils de démo selon VITE_DEMO_PROFILES.
import { test, expect } from '@playwright/test';
import { areDemoProfilesEnabled } from '../../lib/demoProfilesFlag';

test.describe('Profils de démo sur la page de connexion (VITE_DEMO_PROFILES)', () => {
  test('masque les profils de démo par défaut ou pour toute valeur autre que true/1', () => {
    expect(areDemoProfilesEnabled(undefined)).toBe(false);
    expect(areDemoProfilesEnabled('')).toBe(false);
    expect(areDemoProfilesEnabled('false')).toBe(false);
    expect(areDemoProfilesEnabled('0')).toBe(false);
    expect(areDemoProfilesEnabled(false)).toBe(false);
  });

  test('affiche les profils de démo uniquement lorsque VITE_DEMO_PROFILES vaut true ou 1', () => {
    expect(areDemoProfilesEnabled('true')).toBe(true);
    expect(areDemoProfilesEnabled('TRUE')).toBe(true);
    expect(areDemoProfilesEnabled(' 1 ')).toBe(true);
    expect(areDemoProfilesEnabled(true)).toBe(true);
  });
});
