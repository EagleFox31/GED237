import { test, expect } from '@playwright/test';
import {
  RESEND_COOLDOWN_SECONDS,
  canResetApp,
  groupSecret,
  isAppCode,
  isEmailRequiredError,
  isSixDigits,
  otpPrompt,
  resendErrorMessage,
  resendSecondsLeft,
} from '../../components/auth/otpRules';
import { SESSION_EXPIRED, TOO_MANY_TRIES, authErrorMessage, withRoleLabels } from '../../components/auth/authErrors';
import { formatNoticeDate, securityNoticeText } from '../../components/auth/securityNotices';

test.describe('Écrans de connexion : erreurs API en français', () => {
  test('401 et 404 connus traduits', () => {
    expect(authErrorMessage(401, 'Invalid credentials', 'x')).toBe('Échec de connexion. Vérifiez vos identifiants.');
    expect(authErrorMessage(401, 'Invalid OTP', 'x')).toBe('Code invalide');
    expect(authErrorMessage(401, 'Invalid or expired session', 'x')).toBe(SESSION_EXPIRED);
    expect(authErrorMessage(404, 'Invalid or expired enrolment', 'x')).toBe(SESSION_EXPIRED);
    expect(authErrorMessage(404, 'User not found', 'x')).toBe('Compte introuvable.');
  });

  test('429 : texte fixe, quel que soit le détail slowapi', () => {
    expect(authErrorMessage(429, 'Rate limit exceeded: 5 per 1 minute', 'x')).toBe(TOO_MANY_TRIES);
    expect(authErrorMessage(429, undefined, 'x')).toBe(TOO_MANY_TRIES);
  });

  test('422 : libellés de rôle à la place des codes', () => {
    expect(withRoleLabels('Le rôle tenant_admin exige une adresse e-mail')).toBe('Le rôle Admin Institution exige une adresse e-mail');
    expect(withRoleLabels('super_admin ou unit_admin')).toBe('Super Admin ou Admin Service');
    expect(authErrorMessage(422, 'Le rôle super_admin exige une adresse e-mail', 'x')).toBe('Le rôle Super Admin exige une adresse e-mail');
  });

  test('détail inconnu ou absent : message de repli', () => {
    expect(authErrorMessage(500, 'An error occurred during login: boom', 'Repli')).toBe('Repli');
    expect(authErrorMessage(400, undefined, 'Repli')).toBe('Repli');
  });
});

test.describe('Bandeau après connexion : changements de l’application', () => {
  test('réinitialisation par un administrateur, heure UTC convertie', () => {
    const text = securityNoticeText({ event: 'totp_reset', at: '2026-11-17T14:02:11.123456', by_self: false }, 'Africa/Douala');
    expect(text).toBe("Votre application d'authentification a été réinitialisée par un administrateur le 17/11 à 15:02.");
  });

  test('enregistrée ou retirée par soi-même ; événement inconnu ignoré', () => {
    expect(securityNoticeText({ event: 'totp_enrolled', at: '2026-11-17T08:00:00', by_self: true }, 'UTC'))
      .toBe("Votre application d'authentification a été enregistrée le 17/11 à 08:00.");
    expect(securityNoticeText({ event: 'totp_disabled', at: '2026-11-17T08:00:00', by_self: false }, 'UTC'))
      .toBe("Votre application d'authentification a été retirée par un administrateur le 17/11 à 08:00.");
    expect(securityNoticeText({ event: 'password_changed', at: '2026-11-17T08:00:00', by_self: true }, 'UTC')).toBeNull();
  });

  test('date illisible : phrase sans date', () => {
    expect(formatNoticeDate('pas une date', 'UTC')).toBe('');
    expect(securityNoticeText({ event: 'totp_reset', at: 'x', by_self: false }, 'UTC'))
      .toBe("Votre application d'authentification a été réinitialisée par un administrateur.");
  });
});

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

  test('réinitialisation : un supérieur, jamais soi-même', () => {
    expect(canResetApp('super_admin', 'tenant_admin', false)).toBe(true);
    expect(canResetApp('super_admin', 'super_admin', false)).toBe(true);
    expect(canResetApp('super_admin', 'super_admin', true)).toBe(false);
    expect(canResetApp('super_admin', 'manager', false)).toBe(false);
    expect(canResetApp('tenant_admin', 'manager', false)).toBe(true);
    expect(canResetApp('TENANT_ADMIN', 'reader', false)).toBe(true);
    expect(canResetApp('tenant_admin', 'tenant_admin', false)).toBe(false);
    expect(canResetApp('tenant_admin', 'manager', true)).toBe(false);
    expect(canResetApp('manager', 'reader', false)).toBe(false);
    expect(canResetApp(undefined, 'reader', false)).toBe(false);
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
