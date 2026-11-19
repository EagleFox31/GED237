// Changements de l'application d'authentification depuis la connexion précédente (#193) :
// le serveur les donne une seule fois, à la connexion (`security_notices`). Ils sont gardés
// le temps de l'onglet pour le bandeau affiché après la connexion. Sans React, testé par
// `npm run test:unit` (otp-rules.spec.ts).

export type SecurityEvent = 'totp_enrolled' | 'totp_disabled' | 'totp_reset';

export interface SecurityNotice {
  event: SecurityEvent | string;
  /** UTC, sans fuseau (ex. 2026-11-17T14:02:11.123456). */
  at: string;
  /** false : changement fait par un administrateur. */
  by_self: boolean;
}

const STORAGE_KEY = 'security_notices';

const ACTIONS: Record<SecurityEvent, string> = {
  totp_enrolled: 'ajoutée',
  totp_disabled: 'retirée',
  totp_reset: 'réinitialisée',
};

/** « 17/11 à 15:02 » dans le fuseau du navigateur (ou `timeZone`, pour les tests). */
export const formatNoticeDate = (at: string, timeZone?: string): string => {
  const utc = /(Z|[+-]\d\d:?\d\d)$/.test(at) ? at : `${at}Z`;
  const date = new Date(utc);
  if (Number.isNaN(date.getTime())) return '';
  const opts = { timeZone, hour12: false } as const;
  const day = date.toLocaleDateString('fr-FR', { ...opts, day: '2-digit', month: '2-digit' });
  const time = date.toLocaleTimeString('fr-FR', { ...opts, hour: '2-digit', minute: '2-digit' });
  return `${day} à ${time}`;
};

/** Une phrase par changement ; `null` pour un événement inconnu (ignoré). */
export const securityNoticeText = (notice: SecurityNotice, timeZone?: string): string | null => {
  const action = ACTIONS[notice.event as SecurityEvent];
  if (!action) return null;
  const by = notice.by_self ? '' : ' par un administrateur';
  const when = formatNoticeDate(notice.at, timeZone);
  return `Votre application d'authentification a été ${action}${by}${when ? ` le ${when}` : ''}.`;
};

/** Qui prévenir : un administrateur de plateforme pour un compte administrateur. */
export const securityNoticeContact = (role: string | undefined): string =>
  ['super_admin', 'tenant_admin'].includes((role ?? '').toLowerCase())
    ? 'Pas vous ? Contactez un administrateur de plateforme.'
    : 'Pas vous ? Contactez votre administrateur.';

export const saveSecurityNotices = (notices: SecurityNotice[] | undefined): void => {
  try {
    if (notices && notices.length > 0) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(notices));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* stockage indisponible : pas de bandeau, la connexion continue */
  }
};

export const readSecurityNotices = (): SecurityNotice[] => {
  try {
    const parsed: unknown = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? (parsed as SecurityNotice[]) : [];
  } catch {
    return [];
  }
};

export const clearSecurityNotices = (): void => saveSecurityNotices([]);
