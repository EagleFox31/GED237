// Messages des écrans de connexion et d'enrôlement : l'API répond en anglais (ou avec des
// codes de rôle bruts), l'écran affiche une phrase française courte. Sans React, testé par
// `npm run test:unit` (otp-rules.spec.ts).
import { ROLE_LABELS } from '../../constants/roles';

export const TOO_MANY_TRIES = "Trop d'essais. Réessayez dans quelques minutes.";
export const SESSION_EXPIRED = 'Délai dépassé. Reconnectez-vous.';

/** Détails connus de l'API (anglais) → message affiché. */
const KNOWN_DETAILS: Record<string, string> = {
  'invalid credentials': 'Identifiant ou mot de passe incorrect.',
  // Libellé déjà attendu par la recette (auth-2fa E2) : inchangé.
  'invalid otp': 'Code invalide',
  'invalid or expired session': SESSION_EXPIRED,
  'invalid or expired enrolment': SESSION_EXPIRED,
  'user not found': 'Compte introuvable.',
};

/** Remplace les codes de rôle bruts (ex. `tenant_admin`) par leur libellé. */
const ROLE_CODES = new RegExp(`\\b(${Object.keys(ROLE_LABELS).join('|')})\\b`, 'g');

export const withRoleLabels = (text: string): string =>
  text.replace(ROLE_CODES, (code) => ROLE_LABELS[code] ?? code);

/**
 * Message français pour une erreur d'API sur ces écrans.
 * 429 : texte fixe (celui de slowapi est en anglais). Détail connu : sa traduction.
 * 422 : le détail (français côté serveur) avec les libellés de rôle. Sinon : `fallback`.
 */
export const authErrorMessage = (
  status: number | undefined,
  detail: string | undefined,
  fallback: string,
): string => {
  if (status === 429) return TOO_MANY_TRIES;
  const known = KNOWN_DETAILS[(detail ?? '').trim().toLowerCase()];
  if (known) return known;
  if (status === 422 && detail) return withRoleLabels(detail);
  return fallback;
};
