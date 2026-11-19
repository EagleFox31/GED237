export const OTP_LENGTH = 6;

/** Chiffres d'un texte collé (espaces et séparateurs ignorés), au plus OTP_LENGTH. */
export const otpDigitsFromPaste = (text: string): string[] =>
  text.replace(/\D/g, '').slice(0, OTP_LENGTH).split('').filter(Boolean);

/** Code complet après un collage : les cases non couvertes restent vides. */
export const otpFromPaste = (text: string): string[] => {
  const digits = otpDigitsFromPaste(text);
  return Array.from({ length: OTP_LENGTH }, (_, i) => digits[i] ?? '');
};

/** Case à focaliser après un collage : la première vide, sinon la dernière. */
export const otpFocusAfterPaste = (text: string): number =>
  Math.min(otpDigitsFromPaste(text).length, OTP_LENGTH - 1);
