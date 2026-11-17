import { test, expect } from '@playwright/test';
import {
  RESEND_COOLDOWN_SECONDS,
  groupSecret,
  isAppCode,
  isEmailRequiredError,
  isSixDigits,
  otpPrompt,
  resendErrorMessage,
  resendSecondsLeft,
} from '../../components/auth/otpRules';

test.describe('Écran de code : règles', () => {
  test('application : pas de renvoi, texte adapté', () => {
    expect(isAppCode('totp')).toBe(true);
    expect(isAppCode('email')).toBe(false);
    expect(isAppCode(null)).toBe(false);
    expect(otpPrompt('totp')).toContain("application d'authentification");
    expect(otpPrompt('email')).toBe('Saisissez le code reçu par e-mail.');
    expect(otpPrompt(undefined)).toBe('Saisissez le code reçu par e-mail.');
  });

  test('renvoi : délai de 60 s', () => {
    expect(RESEND_COOLDOWN_SECONDS).toBe(60);
    expect(resendSecondsLeft(null, 1_000)).toBe(0);
    expect(resendSecondsLeft(0, 0)).toBe(60);
    expect(resendSecondsLeft(0, 59_001)).toBe(1);
    expect(resendSecondsLeft(0, 60_000)).toBe(0);
    expect(resendSecondsLeft(0, 90_000)).toBe(0);
  });

  test('renvoi refusé : message selon le statut', () => {
    expect(resendErrorMessage(429)).toBe('Trop de demandes, réessayez dans quelques minutes');
    expect(resendErrorMessage(503)).toBe('Envoi impossible pour le moment');
    expect(resendErrorMessage(500)).toBe("Le code n'a pas pu être renvoyé.");
    expect(resendErrorMessage(undefined)).toBe("Le code n'a pas pu être renvoyé.");
  });

  test('agent : 422 « e-mail exigé » reconnu, autres 422 non', () => {
    const detail = "Le rôle tenant_admin exige une adresse e-mail : le code de connexion y est envoyé avant l'enregistrement de l'application d'authentification.";
    expect(isEmailRequiredError(422, detail)).toBe(true);
    expect(isEmailRequiredError(422, 'Hierarchy cycle detected')).toBe(false);
    expect(isEmailRequiredError(400, detail)).toBe(false);
    expect(isEmailRequiredError(undefined, undefined)).toBe(false);
  });

  test('clé lisible et code à 6 chiffres', () => {
    expect(groupSecret('JBSWY3DPEHPK3PXP')).toBe('JBSW Y3DP EHPK 3PXP');
    expect(groupSecret('JBS WY3')).toBe('JBSW Y3');
    expect(isSixDigits('123456')).toBe(true);
    expect(isSixDigits('12345')).toBe(false);
    expect(isSixDigits('12345a')).toBe(false);
    expect(isSixDigits('1234567')).toBe(false);
  });
});
