import { test, expect } from '@playwright/test';

import { PROFILE_REFRESH_MIN_INTERVAL_MS, shouldRefreshProfile } from '../../lib/profileRefresh';

test.describe('Profil : relecture au retour sur l’onglet', () => {
  test('au plus une relecture toutes les 5 minutes', () => {
    const t0 = 1_000_000;
    expect(shouldRefreshProfile(null, t0)).toBe(true);
    expect(shouldRefreshProfile(t0, t0 + 1_000)).toBe(false);
    expect(shouldRefreshProfile(t0, t0 + PROFILE_REFRESH_MIN_INTERVAL_MS - 1)).toBe(false);
    expect(shouldRefreshProfile(t0, t0 + PROFILE_REFRESH_MIN_INTERVAL_MS)).toBe(true);
  });

  test('hors ligne : pas de relecture, même après 5 minutes', () => {
    expect(shouldRefreshProfile(null, 1_000, false)).toBe(false);
    expect(shouldRefreshProfile(0, PROFILE_REFRESH_MIN_INTERVAL_MS, false)).toBe(false);
  });
});
