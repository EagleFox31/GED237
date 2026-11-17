// Messages des écrans de connexion et d'enrôlement : l'API répond en anglais (ou avec des
// codes de rôle bruts), l'écran affiche une phrase française courte. Sans React, testé par
// `npm run test:unit` (otp-rules.spec.ts).
import { ROLE_LABELS } from '../../constants/roles';

export const TOO_MANY_TRIES = "Trop d'essais. Réessayez dans une minute.";
export const TOO_MANY_TRIES_LONGER = "Trop d'essais. Réessayez dans quelques minutes.";
export const SESSION_EXPIRED = 'Délai dépassé. Reconnectez-vous.';
export const LOGIN_FAILED = 'Échec de connexion. Vérifiez vos identifiants.';
export const LOCKED_FALLBACK = 'Compte verrouillé temporairement.';
export const OTP_CONTACT_MISSING =
  "Aucune adresse e-mail n'est enregistrée pour votre compte. Contactez votre administrateur.";
export const OTP_DELIVERY_FAILED = "Le code n'a pas pu être envoyé. Réessayez dans quelques minutes.";

/**
 * Codes d'erreur stables du serveur (#193) → message. Levés seulement après un mot de passe
 * juste (envoi du code), ils ne révèlent donc rien sur l'existence du compte.
 */
const KNOWN_CODES: Record<string, string> = {
  OTP_CONTACT_MISSING, // 409
  OTP_DELIVERY_FAILED, // 503
};

/** Détails connus de l'API (anglais) → message affiché. */
const KNOWN_DETAILS: Record<string, string> = {
  // Libellés déjà attendus par la recette (auth-2fa E1, E2) : inchangés.
  'invalid credentials': LOGIN_FAILED,
  'invalid otp': 'Code invalide',
  'invalid or expired session': SESSION_EXPIRED,
  'invalid or expired enrolment': SESSION_EXPIRED,
  // Avant session, ne jamais laisser deviner qu'un compte existe ou non : même texte qu'E1.
  'user not found': LOGIN_FAILED,
};

/**
 * Limite de débit (slowapi, 429, ex. « Rate limit exceeded: 5 per 1 minute ») : « une minute »
 * quand la fenêtre est d'une minute au plus ou inconnue, sinon « quelques minutes ».
 */
export const rateLimitMessage = (detail: string | undefined): string => {
  const window = /per\s+(\d+)\s+(second|minute|hour|day)/i.exec(detail ?? '');
  if (!window) return TOO_MANY_TRIES;
  const [, count, unit] = window;
  const unitLower = (unit ?? '').toLowerCase();
  const withinMinute = unitLower === 'second' || (unitLower === 'minute' && Number(count) <= 1);
  return withinMinute ? TOO_MANY_TRIES : TOO_MANY_TRIES_LONGER;
};

/**
 * Blocage du compte après trop de codes faux (423, SC-AUTH-02 E3), distinct du 429 de débit :
 * message du serveur et durée restante (`retry_after`, secondes) pour le compte à rebours.
 */
export const accountLockOf = (
  status: number | undefined,
  detail: string | undefined,
  retryAfter: unknown,
): { message: string; seconds: number } | null => {
  if (status !== 423) return null;
  const retry = Number(retryAfter);
  return {
    message: detail || LOCKED_FALLBACK,
    seconds: Number.isFinite(retry) && retry >= 1 ? Math.ceil(retry) : 60,
  };
};

/** Remplace les codes de rôle bruts (ex. `tenant_admin`) par leur libellé. */
const ROLE_CODES = new RegExp(`\\b(${Object.keys(ROLE_LABELS).join('|')})\\b`, 'g');

export const withRoleLabels = (text: string): string =>
  text.replace(ROLE_CODES, (code) => ROLE_LABELS[code] ?? code);

/**
 * Message français pour une erreur d'API sur ces écrans.
 * 429 : texte fixe selon la fenêtre (celui de slowapi est en anglais). Le blocage du compte est
 * un 423, traité à part par `accountLockOf`. Détail connu : sa traduction.
 * 422 : le détail (français côté serveur) avec les libellés de rôle. Code d'envoi du code connu
 * (`errorCode`) : son message. Sinon : `fallback`.
 */
export const authErrorMessage = (
  status: number | undefined,
  detail: string | undefined,
  fallback: string,
  errorCode?: string,
): string => {
  if (status === 429) return rateLimitMessage(detail);
  const byCode = errorCode ? KNOWN_CODES[errorCode] : undefined;
  if (byCode) return byCode;
  const known = KNOWN_DETAILS[(detail ?? '').trim().toLowerCase()];
  if (known) return known;
  if (status === 422 && detail) return withRoleLabels(detail);
  return fallback;
};
