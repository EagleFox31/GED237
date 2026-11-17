// Règles de l'écran de code (e-mail ou application), sans React, testées par `npm run test:unit`.

/** Délai avant de pouvoir redemander un code par e-mail (#154). */
export const RESEND_COOLDOWN_SECONDS = 60;

/** Les comptes à application (DEC-2026-004) n'ont pas de code à renvoyer. */
export const isAppCode = (method: string | null | undefined): boolean => method === 'totp';

export const otpPrompt = (method: string | null | undefined): string =>
  isAppCode(method)
    ? "Saisissez le code affiché dans votre application d'authentification."
    : 'Saisissez le code reçu par e-mail.';

/** Message d'un renvoi refusé, selon le statut HTTP. */
export const resendErrorMessage = (status: number | undefined): string => {
  if (status === 429) return 'Trop de demandes, réessayez dans quelques minutes';
  if (status === 503) return 'Envoi impossible pour le moment';
  return "Le code n'a pas pu être renvoyé.";
};

/** Secondes restantes avant un nouveau renvoi, à partir de l'instant du dernier envoi. */
export const resendSecondsLeft = (sentAt: number | null, now: number): number => {
  if (sentAt === null) return 0;
  const left = Math.ceil((sentAt + RESEND_COOLDOWN_SECONDS * 1000 - now) / 1000);
  return left > 0 ? left : 0;
};

/** Secret base32 lisible à la main : groupes de 4. */
export const groupSecret = (secret: string): string =>
  secret.replace(/\s+/g, '').replace(/(.{4})(?=.)/g, '$1 ');

/**
 * 422 de création/modification d'agent : le rôle (administrateur) exige un e-mail, car le
 * premier code y est envoyé avant l'enrôlement (DEC-2026-004). Le serveur n'a pas de code
 * d'erreur dédié : on reconnaît son message.
 */
export const isEmailRequiredError = (status: number | undefined, message: string | undefined): boolean =>
  status === 422 && /adresse e-mail/i.test(message ?? '');

/** Code de l'application : exactement 6 chiffres. */
export const isSixDigits = (code: string): boolean => /^\d{6}$/.test(code);
