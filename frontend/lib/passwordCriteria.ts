// Critères affichés sous le champ « nouveau mot de passe » ; la même liste pilote le bouton d'envoi.
export const PASSWORD_MIN_LENGTH = 12;

export interface PasswordCriterion {
  label: string;
  ok: boolean;
}

export const passwordCriteria = (pwd: string): PasswordCriterion[] => [
  { label: `${PASSWORD_MIN_LENGTH} caractères minimum`, ok: pwd.length >= PASSWORD_MIN_LENGTH },
  { label: 'Une lettre majuscule', ok: /[A-Z]/.test(pwd) },
  { label: 'Un chiffre', ok: /[0-9]/.test(pwd) },
  { label: 'Un caractère spécial (@, #, &…)', ok: /[^A-Za-z0-9]/.test(pwd) },
];

export const allPasswordCriteriaMet = (pwd: string): boolean => passwordCriteria(pwd).every((c) => c.ok);
