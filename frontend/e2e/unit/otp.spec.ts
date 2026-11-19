import { test, expect } from '@playwright/test';

import { otpDigitsFromPaste, otpFocusAfterPaste, otpFromPaste } from '../../lib/otp';

test.describe('Saisie du code : collage', () => {
  test('un code complet collé remplit les 6 cases', () => {
    expect(otpFromPaste('123456')).toEqual(['1', '2', '3', '4', '5', '6']);
  });

  test('espaces et tirets ignorés, excédent coupé', () => {
    expect(otpDigitsFromPaste('123 456-78')).toEqual(['1', '2', '3', '4', '5', '6']);
  });

  test('un code partiel laisse les cases suivantes vides', () => {
    expect(otpFromPaste('12')).toEqual(['1', '2', '', '', '', '']);
    expect(otpFocusAfterPaste('12')).toBe(2);
  });

  test('un code complet place le focus sur la dernière case', () => {
    expect(otpFocusAfterPaste('123456')).toBe(5);
  });

  test('texte sans chiffre : rien à coller', () => {
    expect(otpDigitsFromPaste('abc')).toEqual([]);
  });
});
